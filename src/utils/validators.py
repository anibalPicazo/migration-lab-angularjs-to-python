"""DNI validation utility module."""

import re
from typing import TypedDict


class ValidationResult(TypedDict):
    """Structured validation result."""

    valid: bool
    error: str | None


# Spanish DNI checksum letter table
VALID_LETTERS = "TRWAGMYFPDXBNJZSQVHLCKE"

# DNI format regex: 8 digits + 1 uppercase letter
DNI_REGEX = re.compile(r"^\d{8}[A-Z]$")


def validate_dni(dni: str) -> ValidationResult:
    """
    Validate Spanish DNI format and checksum.

    Args:
        dni: DNI string to validate (e.g., "12345678Z")

    Returns:
        ValidationResult with valid flag and optional error message
    """
    # Trim whitespace
    dni = dni.strip()

    # Check for empty input
    if not dni:
        return {"valid": False, "error": "errors.dni_required"}

    # Normalize to uppercase
    dni = dni.upper()

    # Check format (8 digits + 1 letter)
    if not DNI_REGEX.match(dni):
        return {"valid": False, "error": "errors.dni_invalid_format"}

    # Extract numeric part and letter
    digits = int(dni[:8])
    letter = dni[8]

    # Validate checksum
    expected_letter = VALID_LETTERS[digits % 23]
    if letter != expected_letter:
        return {"valid": False, "error": "errors.dni_invalid_checksum"}

    return {"valid": True, "error": None}
