import logging
import os
import secrets
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

import requests

from odoo import http
from odoo.http import request

_logger = logging.getLogger(__name__)

THREADS_AUTHORIZE_URL = "https://threads.net/oauth/authorize"
THREADS_TOKEN_URL = "https://graph.threads.net/oauth/access_token"
THREADS_LONG_LIVED_TOKEN_URL = "https://graph.threads.net/access_token"
THREADS_REFRESH_TOKEN_URL = "https://graph.threads.net/refresh_access_token"
THREADS_API_URL = "https://graph.threads.net/me/threads"
THREADS_PROFILE_URL = "https://graph.threads.net/me"
THREADS_PROFILE_FIELDS = "id,username,name,threads_profile_picture_url"
THREADS_INSIGHTS_METRICS = "views,likes,replies,reposts,quotes,shares"
THREADS_FEED_CACHE_TTL = 60
THREADS_REPLIES_CACHE_TTL = 60

_feed_cache = {}
_replies_cache = {}
_cache_lock = threading.Lock()

THREADS_REPLY_FIELDS = (
    "id,text,timestamp,media_type,media_url,thumbnail_url,gif_url,"
    "permalink,shortcode,username,profile_picture_url"
)


class ThreadsController(http.Controller):

    def _config(self, key, env_name=None):
        value = request.env["ir.config_parameter"].sudo().get_param(key)
        return value or (os.environ.get(env_name) if env_name else None)

    def _redirect_uri(self):
        return (
            self._config(
                "odoo_website_social_feed.threads_redirect_uri",
                "THREADS_REDIRECT_URI",
            )
            or request.httprequest.host_url.rstrip("/") + "/threads/callback"
        )

    def _is_admin(self):
        return request.env.user.has_group("base.group_system")

    def _admin_or_not_found(self):
        if not self._is_admin():
            return request.not_found()
        return None

    @http.route("/threads/connect", type="http", auth="user", methods=["GET"])
    def threads_connect(self, **kwargs):
        if self._admin_or_not_found():
            return request.not_found()

        client_id = self._config(
            "odoo_website_social_feed.threads_client_id",
            "THREADS_CLIENT_ID",
        )
        if not client_id:
            return request.make_response(
                "Threads API is not configured: missing Threads App ID.",
                headers=[("Content-Type", "text/plain; charset=utf-8")],
                status=500,
            )

        state = secrets.token_urlsafe(32)
        request.session["threads_oauth_state"] = state

        params = {
            "client_id": client_id,
            "redirect_uri": self._redirect_uri(),
            "scope": "threads_basic,threads_manage_insights,threads_read_replies",
            "response_type": "code",
            "state": state,
        }
        return request.redirect(f"{THREADS_AUTHORIZE_URL}?{urlencode(params)}", local=False)

    @http.route(
        "/threads/callback",
        type="http",
        auth="public",
        methods=["GET"],
        csrf=False,
    )
    def threads_callback(
        self,
        code=None,
        state=None,
        error=None,
        error_description=None,
        **kwargs,
    ):
        expected_state = request.session.get("threads_oauth_state")
        request.session.pop("threads_oauth_state", None)

        if error:
            return request.make_response(
                f"Threads authorization failed: {error_description or error}",
                headers=[("Content-Type", "text/plain; charset=utf-8")],
                status=400,
            )

        if not code:
            return request.make_response(
                "Threads authorization failed: missing authorization code.",
                headers=[("Content-Type", "text/plain; charset=utf-8")],
                status=400,
            )

        if not expected_state or not state or not secrets.compare_digest(
            state, expected_state
        ):
            return request.make_response(
                "Threads authorization failed: invalid OAuth state. Start the connection again from Odoo.",
                headers=[("Content-Type", "text/plain; charset=utf-8")],
                status=400,
            )

        client_id = self._config(
            "odoo_website_social_feed.threads_client_id",
            "THREADS_CLIENT_ID",
        )
        client_secret = self._config(
            "odoo_website_social_feed.threads_client_secret",
            "THREADS_CLIENT_SECRET",
        )
        redirect_uri = self._redirect_uri()

        if not client_id or not client_secret:
            return request.make_response(
                "Threads API is not configured: missing App ID or App Secret.",
                headers=[("Content-Type", "text/plain; charset=utf-8")],
                status=500,
            )

        try:
            response = requests.post(
                THREADS_TOKEN_URL,
                data={
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "grant_type": "authorization_code",
                    "redirect_uri": redirect_uri,
                    "code": code,
                },
                timeout=15,
            )
            response.raise_for_status()
            token_data = response.json()
            short_token = token_data["access_token"]
            user_id = token_data.get("user_id", "")

            response = requests.get(
                THREADS_LONG_LIVED_TOKEN_URL,
                params={
                    "grant_type": "th_exchange_token",
                    "client_secret": client_secret,
                    "access_token": short_token,
                },
                timeout=15,
            )
            response.raise_for_status()
            long_token_data = response.json()
            access_token = long_token_data["access_token"]
            expires_in = int(long_token_data.get("expires_in", 0) or 0)

            params = request.env["ir.config_parameter"].sudo()
            params.set_param(
                "odoo_website_social_feed.threads_access_token",
                access_token,
            )
            params.set_param(
                "odoo_website_social_feed.threads_user_id",
                user_id,
            )

            profile = self._get_profile(access_token)
            if profile.get("username"):
                params.set_param(
                    "odoo_website_social_feed.threads_username",
                    profile["username"],
                )
            if profile.get("name"):
                params.set_param(
                    "odoo_website_social_feed.threads_name",
                    profile["name"],
                )
            if profile.get("threads_profile_picture_url"):
                params.set_param(
                    "odoo_website_social_feed.threads_profile_picture_url",
                    profile["threads_profile_picture_url"],
                )
            if expires_in:
                expires_at = datetime.now(timezone.utc) + timedelta(
                    seconds=expires_in
                )
                params.set_param(
                    "odoo_website_social_feed.threads_token_expires_at",
                    expires_at.isoformat(),
                )
            params.set_param(
                "odoo_website_social_feed.threads_connected",
                "1",
            )
            self._invalidate_social_cache()

        except (requests.RequestException, KeyError, ValueError) as exc:
            _logger.exception("Threads OAuth token exchange failed")
            return request.make_response(
                "Threads authorization failed. Check the Odoo server log for details.",
                headers=[("Content-Type", "text/plain; charset=utf-8")],
                status=502,
            )

        return request.redirect("/threads/status")

    @http.route("/threads/status", type="http", auth="user", methods=["GET"])
    def threads_status(self, **kwargs):
        if self._admin_or_not_found():
            return request.not_found()

        params = request.env["ir.config_parameter"].sudo()
        connected = bool(
            params.get_param("odoo_website_social_feed.threads_access_token")
        )
        username = params.get_param(
            "odoo_website_social_feed.threads_username"
        )
        if connected:
            message = (
                "Threads is connected."
                + (f" @{username}" if username else "")
            )
        else:
            message = "Threads is not connected."

        return request.make_response(
            message,
            headers=[("Content-Type", "text/plain; charset=utf-8")],
        )

    def _invalidate_social_cache(self):
        with _cache_lock:
            _feed_cache.clear()
            _replies_cache.clear()

    def _get_cached(self, cache, key, ttl):
        now = time.monotonic()
        with _cache_lock:
            item = cache.get(key)
            if item and now - item[0] < ttl:
                return item[1]
            if item:
                cache.pop(key, None)
        return None

    def _set_cached(self, cache, key, value):
        with _cache_lock:
            cache[key] = (time.monotonic(), value)

    def _get_profile(self, access_token):
        try:
            response = requests.get(
                THREADS_PROFILE_URL,
                params={
                    "fields": THREADS_PROFILE_FIELDS,
                    "access_token": access_token,
                },
                timeout=15,
            )
            response.raise_for_status()
            return response.json()
        except (requests.RequestException, ValueError):
            _logger.exception("Threads profile request failed")
            return {}

    def _get_post_insights(self, access_token, post_id):
        try:
            response = requests.get(f"https://graph.threads.net/{post_id}/insights",
                params={
                    "metric": THREADS_INSIGHTS_METRICS,
                    "access_token": access_token,
                },
                timeout=10,
            )
            response.raise_for_status()
            payload = response.json()
        except requests.RequestException as exc:
            if exc.response is not None:
                _logger.warning(
                    "Unable to load insights for Threads post %s: HTTP %s %s",
                    post_id,
                    exc.response.status_code,
                    exc.response.text[:1000],
                )
            else:
                _logger.warning(
                    "Unable to load insights for Threads post %s: %s",
                    post_id,
                    exc,
                )
            return {}
        except ValueError as exc:
            _logger.warning(
                "Unable to parse insights for Threads post %s: %s",
                post_id,
                exc,
            )
            return {}

        metrics = {}
        for item in payload.get("data", []):
            name = item.get("name")
            if not name:
                continue
            values = item.get("values") or []
            if values and "value" in values[0]:
                metrics[name] = values[0]["value"]
            elif isinstance(item.get("total_value"), dict):
                metrics[name] = item["total_value"].get("value")
        return metrics
    def _refresh_token_if_needed(self):
        params = request.env["ir.config_parameter"].sudo()
        access_token = params.get_param(
            "odoo_website_social_feed.threads_access_token"
        )
        expires_at = params.get_param(
            "odoo_website_social_feed.threads_token_expires_at"
        )

        if not access_token:
            return None

        should_refresh = False
        if expires_at:
            try:
                expiry = datetime.fromisoformat(expires_at)
                if expiry.tzinfo is None:
                    expiry = expiry.replace(tzinfo=timezone.utc)
                should_refresh = expiry <= datetime.now(timezone.utc) + timedelta(days=7)
            except ValueError:
                should_refresh = False

        if not should_refresh:
            return access_token

        try:
            response = requests.get(
                THREADS_REFRESH_TOKEN_URL,
                params={
                    "grant_type": "th_refresh_token",
                    "access_token": access_token,
                },
                timeout=15,
            )
            response.raise_for_status()
            data = response.json()
            access_token = data["access_token"]
            expires_in = int(data.get("expires_in", 0) or 0)

            params.set_param(
                "odoo_website_social_feed.threads_access_token",
                access_token,
            )
            if expires_in:
                params.set_param(
                    "odoo_website_social_feed.threads_token_expires_at",
                    (
                        datetime.now(timezone.utc)
                        + timedelta(seconds=expires_in)
                    ).isoformat(),
                )
            return access_token
        except (requests.RequestException, KeyError, ValueError):
            _logger.exception("Threads access token refresh failed")
            return params.get_param(
                "odoo_website_social_feed.threads_access_token"
            )

    @http.route(
        "/threads/replies",
        type="http",
        auth="public",
        methods=["GET"],
        csrf=False,
    )
    def threads_replies(self, post_id=None, limit=10, **kwargs):
        access_token = self._refresh_token_if_needed()
        if not access_token:
            return request.make_json_response(
                {"data": [], "error": "Threads feed is not connected."},
                status=503,
            )

        if not post_id:
            return request.make_json_response(
                {"data": [], "error": "Missing Threads post ID."},
                status=400,
            )

        try:
            limit = max(1, min(int(limit), 20))
        except (TypeError, ValueError):
            limit = 10

        cache_key = (post_id, limit)
        cached = self._get_cached(_replies_cache, cache_key, THREADS_REPLIES_CACHE_TTL)
        if cached is not None:
            return request.make_json_response(cached)

        try:
            response = requests.get(
                f"https://graph.threads.net/{post_id}/replies",
                params={
                    "fields": THREADS_REPLY_FIELDS,
                    "limit": limit,
                    "access_token": access_token,
                },
                timeout=15,
            )
            response.raise_for_status()
            payload = response.json()
        except requests.RequestException as exc:
            if exc.response is not None:
                _logger.warning(
                    "Unable to load replies for Threads post %s: HTTP %s %s",
                    post_id,
                    exc.response.status_code,
                    exc.response.text[:1000],
                )
            else:
                _logger.warning(
                    "Unable to load replies for Threads post %s: %s",
                    post_id,
                    exc,
                )
            return request.make_json_response(
                {"data": [], "error": "Unable to load Threads replies."},
                status=502,
            )
        except ValueError as exc:
            _logger.warning(
                "Unable to parse replies for Threads post %s: %s",
                post_id,
                exc,
            )
            return request.make_json_response(
                {"data": [], "error": "Unable to load Threads replies."},
                status=502,
            )

        result = {
            "data": payload.get("data", []),
            "paging": payload.get("paging", {}),
        }
        self._set_cached(_replies_cache, cache_key, result)
        return request.make_json_response(result)

    @http.route(
        "/threads/feed",
        type="http",
        auth="public",
        methods=["GET"],
        csrf=False,
    )
    def threads_feed(self, limit=10, **kwargs):
        access_token = self._refresh_token_if_needed()
        if not access_token:
            return request.make_json_response(
                {"data": [], "error": "Threads feed is not connected."},
                status=503,
            )

        try:
            limit = max(1, min(int(limit), 25))
        except (TypeError, ValueError):
            limit = 10

        cache_key = limit
        cached = self._get_cached(_feed_cache, cache_key, THREADS_FEED_CACHE_TTL)
        if cached is not None:
            return request.make_json_response(cached)

        try:
            response = requests.get(
                THREADS_API_URL,
                params={
                    "fields": (
                        "id,media_type,media_url,thumbnail_url,permalink,"
                        "username,text,timestamp,shortcode"
                    ),
                    "limit": limit,
                    "access_token": access_token,
                },
                timeout=15,
            )
            response.raise_for_status()
            payload = response.json()
        except (requests.RequestException, ValueError):
            _logger.exception("Threads feed request failed")
            return request.make_json_response(
                {"data": [], "error": "Unable to load the Threads feed."},
                status=502,
            )

        posts = payload.get("data", [])

        params = request.env["ir.config_parameter"].sudo()
        profile = {
            "username": params.get_param("odoo_website_social_feed.threads_username"),
            "name": params.get_param("odoo_website_social_feed.threads_name"),
            "threads_profile_picture_url": params.get_param(
                "odoo_website_social_feed.threads_profile_picture_url"
            ),
        }

        insights = {}
        if posts:
            with ThreadPoolExecutor(max_workers=min(5, len(posts))) as executor:
                futures = {
                    executor.submit(
                        self._get_post_insights,
                        access_token,
                        post.get("id"),
                    ): post.get("id")
                    for post in posts
                    if post.get("id")
                }
                for future in as_completed(futures):
                    post_id = futures[future]
                    try:
                        insights[post_id] = future.result()
                    except Exception:
                        _logger.exception(
                            "Unexpected Threads insight error for post %s",
                            post_id,
                        )

        for post in posts:
            post["insights"] = insights.get(post.get("id"), {})

        result = {
            "data": posts,
            "profile": {
                "username": profile.get("username"),
                "name": profile.get("name"),
                "threads_profile_picture_url": profile.get("threads_profile_picture_url"),
            },
            "paging": payload.get("paging", {}),
        }
        self._set_cached(_feed_cache, cache_key, result)
        return request.make_json_response(result)
