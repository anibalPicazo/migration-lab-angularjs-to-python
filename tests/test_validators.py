"""Unit tests for DNI validation."""

import pytest

from src.utils.validators import validate_dni


class TestValidateDni:
    """Test suite for validate_dni function."""

    def test_valid_dni_12345678z(self):
        """Test valid DNI: 12345678Z."""
        result = validate_dni("12345678Z")
        assert result["valid"] is True
        assert result["error"] is None

    def test_valid_dni_00000001r(self):
        """Test valid DNI with leading zeros: 00000001R."""
        result = validate_dni("00000001R")
        assert result["valid"] is True
        assert result["error"] is None

    def test_valid_dni_case_insensitive(self):
        """Test DNI with lowercase letter is normalized."""
        result = validate_dni("12345678z")
        assert result["valid"] is True
        assert result["error"] is None

    def test_invalid_format_too_short(self):
        """Test invalid format: too few digits."""
        result = validate_dni("1234567Z")
        assert result["valid"] is False
        assert result["error"] == "errors.dni_invalid_format"

    def test_invalid_format_too_long(self):
        """Test invalid format: too many digits."""
        result = validate_dni("123456789Z")
        assert result["valid"] is False
        assert result["error"] == "errors.dni_invalid_format"

    def test_invalid_format_special_chars(self):
        """Test invalid format: special characters."""
        result = validate_dni("12345-678Z")
        assert result["valid"] is False
        assert result["error"] == "errors.dni_invalid_format"

    def test_invalid_format_letter_in_digits(self):
        """Test invalid format: letter in digit position."""
        result = validate_dni("A2345678Z")
        assert result["valid"] is False
        assert result["error"] == "errors.dni_invalid_format"

    def test_invalid_checksum(self):
        """Test invalid checksum: wrong letter."""
        result = validate_dni("12345678A")
        assert result["valid"] is False
        assert result["error"] == "errors.dni_invalid_checksum"

    def test_empty_input(self):
        """Test empty input."""
        result = validate_dni("")
        assert result["valid"] is False
        assert result["error"] == "errors.dni_required"

    def test_whitespace_only_input(self):
        """Test whitespace-only input."""
        result = validate_dni("   ")
        assert result["valid"] is False
        assert result["error"] == "errors.dni_required"

    def test_whitespace_trimming(self):
        """Test that leading/trailing whitespace is trimmed."""
        result = validate_dni("  12345678Z  ")
        assert result["valid"] is True
        assert result["error"] is None

    def test_performance(self):
        """Test that validation completes in under 10ms."""
        import time

        start = time.perf_counter()
        validate_dni("12345678Z")
        elapsed = (time.perf_counter() - start) * 1000  # Convert to ms

        assert elapsed < 10, f"Validation took {elapsed:.2f}ms (should be < 10ms)"
