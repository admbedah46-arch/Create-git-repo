# Security Specification & Test Payloads

## 1. Data Invariants
- Application data is stored under `/appData/{docId}` and `/patients/{patientId}`.
- Authenticated users can read and write application records.
- Document IDs must match standard ID format `^[a-zA-Z0-9_\\-]+$`.

## 2. Test Payloads (Dirty Dozen Verification)
1. Unauthorized anonymous read/write block
2. Junk character docId injection block
3. Malicious oversized payload block
