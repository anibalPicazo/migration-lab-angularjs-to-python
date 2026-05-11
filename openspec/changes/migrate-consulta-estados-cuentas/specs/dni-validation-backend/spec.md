## ADDED Requirements

### Requirement: Validate Spanish DNI format structure

The system SHALL validate that DNI input matches the Spanish format: exactly 8 digits followed by exactly 1 uppercase letter.

#### Scenario: Valid DNI format accepted
- **WHEN** input is "12345678Z"
- **THEN** format validation SHALL pass (8 digits + 1 letter)

#### Scenario: Invalid format - too few digits
- **WHEN** input is "1234567Z" (only 7 digits)
- **THEN** format validation SHALL fail

#### Scenario: Invalid format - too many digits
- **WHEN** input is "123456789Z" (9 digits)
- **THEN** format validation SHALL fail

#### Scenario: Invalid format - lowercase letter
- **WHEN** input is "12345678z" (lowercase letter)
- **THEN** system SHALL normalize to uppercase "12345678Z" before validation

#### Scenario: Invalid format - special characters
- **WHEN** input is "12345-678Z" or "12.345.678-Z"
- **THEN** format validation SHALL fail

#### Scenario: Invalid format - letters in digit positions
- **WHEN** input is "A2345678Z"
- **THEN** format validation SHALL fail

### Requirement: Validate DNI checksum using modulo 23 algorithm

The system SHALL validate DNI checksum by calculating expected letter from numeric part using Spanish DNI algorithm.

Algorithm: `expected_letter = LETTERS[int(dni[:8]) % 23]` where `LETTERS = "TRWAGMYFPDXBNJZSQVHLCKE"`

#### Scenario: Valid DNI checksum passes
- **WHEN** input is "12345678Z"
- **THEN** system calculates: 12345678 % 23 = 14
- **THEN** expected letter is LETTERS[14] = "Z"
- **THEN** checksum validation SHALL pass

#### Scenario: Invalid DNI checksum fails
- **WHEN** input is "12345678A"
- **THEN** system calculates: 12345678 % 23 = 14
- **THEN** expected letter is "Z" but actual is "A"
- **THEN** checksum validation SHALL fail with message "La letra del DNI no es correcta"

#### Scenario: Edge case - DNI starting with zeros
- **WHEN** input is "00000001R"
- **THEN** system calculates: 1 % 23 = 1
- **THEN** expected letter is LETTERS[1] = "R"
- **THEN** checksum validation SHALL pass

#### Scenario: Edge case - maximum DNI number
- **WHEN** input is "99999999R"
- **THEN** system calculates: 99999999 % 23 = 7
- **THEN** expected letter is LETTERS[7] = "F"
- **THEN** checksum validation SHALL fail (actual letter is "R")

### Requirement: Return structured validation result

The system SHALL return structured validation result with success flag and optional error message.

#### Scenario: Validation returns success result
- **WHEN** DNI "12345678Z" is validated
- **THEN** function SHALL return: `{"valid": true, "error": null}`

#### Scenario: Validation returns format error
- **WHEN** DNI "1234" is validated
- **THEN** function SHALL return: `{"valid": false, "error": "errors.dni_invalid_format"}`

#### Scenario: Validation returns checksum error
- **WHEN** DNI "12345678A" is validated
- **THEN** function SHALL return: `{"valid": false, "error": "errors.dni_invalid_checksum"}`

### Requirement: Validation is case-insensitive

The system SHALL accept DNI letters in lowercase and normalize to uppercase before validation.

#### Scenario: Lowercase letter normalized
- **WHEN** input is "12345678z"
- **THEN** system normalizes to "12345678Z"
- **THEN** validation SHALL pass

### Requirement: Empty or whitespace input rejected

The system SHALL reject empty or whitespace-only DNI input.

#### Scenario: Empty string rejected
- **WHEN** input is ""
- **THEN** validation SHALL fail with error "errors.dni_required"

#### Scenario: Whitespace string rejected
- **WHEN** input is "   "
- **THEN** validation SHALL fail with error "errors.dni_required"

#### Scenario: Leading/trailing whitespace trimmed
- **WHEN** input is "  12345678Z  "
- **THEN** system SHALL trim to "12345678Z"
- **THEN** validation SHALL proceed normally

### Requirement: Validation function is pure and deterministic

The system SHALL implement DNI validation as a pure function with no side effects.

#### Scenario: Same input produces same output
- **WHEN** "12345678Z" is validated multiple times
- **THEN** result SHALL always be `{"valid": true, "error": null}`

#### Scenario: Validation has no side effects
- **WHEN** validation function is called
- **THEN** function SHALL NOT modify any external state
- **THEN** function SHALL NOT make network calls
- **THEN** function SHALL NOT log to console in production mode

### Requirement: Performance constraint

The system SHALL validate DNI in under 10 milliseconds per call.

#### Scenario: Validation completes quickly
- **WHEN** DNI validation is called
- **THEN** function SHALL complete in under 10ms
- **THEN** no database or network calls are made
