# SkyData HP project tests

ZIP uploads are available directly in Engineering Mode and the HP runner page,
using the existing owner-scoped project storage. Analysis continues to use
explicitly labeled source excerpts; it cannot edit or execute projects.

The runner page reads complete indexed source files from a selected saved ZIP.
It lists exclusions, shows the exact selected source, and asks the owner to
select a JavaScript test entry. Up to 100 files / 400 KB total source are
submitted. Assets, incomplete indexed files, dependency directories, unsafe
paths and credential-like filenames are excluded. This is a filename filter,
not a comprehensive secret scanner. Owners must review source before approval.

The backend retrieves the source again from owner-scoped storage when queuing
and captures an immutable selected-file snapshot. It never accepts replacement
source in the project-test request. The final result includes the selected
paths, entry and a server-computed SHA-256 of that queued snapshot.

Protocol 2 must be advertised by the device. Older runners continue to run
snippets, but cannot queue/claim project tests. The downloadable ZIP includes
the shared project validation module. Existing profile pairing is preserved.

Selected files are written to a unique /tmp directory inside the restricted
Docker container. A fixed node --test invocation runs the selected entry with
relative imports into selected files. No host mounts, downloaded packages,
package scripts, provider keys, or network. Existing original ZIPs and HP
project directories are not edited. Root remains read-only, non-root, 256 MB,
one CPU, 64 processes, with bounded output and outer 10-second execution.
An internal 8-second process timeout reports timeout. Approval is still local;
the waiting/claim window is now 10 minutes rather than 60 seconds.

Validation: TypeScript check and production build; real Node fixture tests for
relative imports, pass/fail/missing files; runner mocked-process isolation and
failure contracts; real SQLite authorization, job claims and results; built
Worker with real D1/R2 verifies owner access, incomplete/credential exclusions,
old-runner gating, ten-minute approval and result snapshot fingerprints.
Existing Engineering handler tests also pass with external inference mocked.
The package was checked against the exact runner source.

No authoring browser QA or live HP project execution was performed. The prior
live HP snippet test passed, but is not evidence of this project's new file
materialization path. Use the supplied two-file sample ZIP for the first live
project check after publication and runner replacement.

No automatic AI execution, project edits, dependencies or full project builds
are included. Container isolation is not a guarantee against every escape.
