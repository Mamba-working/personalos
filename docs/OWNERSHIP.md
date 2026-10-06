# Ownership and contribution

The repository maintainer is accountable for the complete product and release truth. Specific verified GitHub handles should be added to CODEOWNERS when maintainers are assigned; no invented account is installed as an owner.

Responsibilities:

- Web owner: layout/motion/accessibility, host ownership, native navigation/keyboard and browser regression
- API owner: HTTP behavior, credentials, authorization, data retention and operational limits
- Contracts owner: versioned payload/schema compatibility and frontend/backend boundary tests
- Release owner: exact source/runtime/deployment mapping, evidence limits, licenses and acceptance status

Before a change:

1. Keep scope and implementation status explicit
2. Preserve fixture licenses and byte references; do not delete negative controls to make tests pass
3. Run npm run check and npm test; report failed, blocked or never-run checks honestly
4. Update contracts/docs/provenance when behavior or ownership changes
5. Use a draft pull request for review; publishing an import does not authorize automatic deployment

Backend-related open decisions:

- Which content is demo-only and which content should become user-owned?
- Does the real product need authentication and what data should persist?
- Which provider/hosting/storage choices and retention rules are authorized?
- Is the product strictly non-commercial, or does it require a separately licensed/replaced character before commercial release?
