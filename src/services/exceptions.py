"""Custom exceptions for backend integration."""


class BackendError(Exception):
    """Base exception for backend errors."""

    pass


class BackendTimeoutError(BackendError):
    """Backend request timed out."""

    pass


class BackendServerError(BackendError):
    """Backend returned HTTP 500."""

    pass


class BackendUnavailableError(BackendError):
    """Backend returned HTTP 503."""

    pass


class BackendDataError(BackendError):
    """Backend returned invalid or malformed data."""

    pass


class BackendValidationError(BackendError):
    """Backend returned HTTP 400 validation error."""

    pass
