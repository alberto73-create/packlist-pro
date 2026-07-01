# Packlist Pro PDF adapters

Packlist Pro uses local PDF adapters so PDF export can work without loading code from a CDN at runtime.

## Chosen approach for this PR

This PR intentionally keeps **Packlist Pro adapters**, not upstream jsPDF builds, because the official complete vendor files could not be obtained and verified reliably in this environment. The adapters are named accordingly so they do not pretend to be official jsPDF or jsPDF AutoTable distributions.

## Current files

| File | API exposed | Version | Origin/source | License note |
| --- | --- | --- | --- | --- |
| `packlist-pdf-adapter.js` | Exposes `window.jspdf.jsPDF` methods used by Packlist Pro PDF export | Packlist Pro adapter for app version `1.10.25` | Created in-repo for the offline-first PDF export step | Project license; not an upstream jsPDF build |
| `packlist-autotable-adapter.js` | Adds `doc.autoTable` methods used by Packlist Pro PDF export | Packlist Pro adapter for app version `1.10.25` | Created in-repo for the offline-first PDF export step | Project license; not an upstream jsPDF AutoTable build |

## Upstream libraries previously loaded from CDN

The app previously loaded these runtime CDN assets:

- jsPDF `2.5.1`: `https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js`
- jsPDF AutoTable `3.5.31`: `https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.31/jspdf.plugin.autotable.min.js`

## Future safe upgrade path

If the project needs the full upstream libraries instead of adapters, replace these adapter files with official distribution builds only after verifying:

1. exact package versions (`jspdf@2.5.1`, `jspdf-autotable@3.5.31` or newer pinned versions);
2. upstream source URL or npm package tarball;
3. license text/link;
4. file integrity/checksum;
5. browser export PDF online and offline after service worker cache population.

## Legacy alias policy

Do not add adapter copies named like official upstream jsPDF or jsPDF AutoTable distribution builds. Runtime and precache entries must use the `packlist-*` adapter names so provenance stays clear and integrity checks can reject stale aliases.
