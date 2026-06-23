# PDF vendor assets

These files are local PDF export assets used by Packlist Pro so the PWA does not load PDF code from a CDN at runtime.

## Current files

| File | Library/API | Version | Origin/source | License note |
| --- | --- | --- | --- | --- |
| `jspdf.umd.min.js` | Local jsPDF-compatible adapter exposing `window.jspdf.jsPDF` | Packlist Pro local adapter, not upstream jsPDF | Created in-repo for the offline-first PDF export step | Project license; replace with upstream jsPDF before claiming upstream jsPDF compatibility |
| `jspdf.plugin.autotable.min.js` | Local AutoTable-compatible adapter exposing `doc.autoTable` | Packlist Pro local adapter, not upstream jsPDF AutoTable | Created in-repo for the offline-first PDF export step | Project license; replace with upstream jsPDF AutoTable before claiming upstream AutoTable compatibility |

## Upstream libraries originally used from CDN

The previous runtime CDN references were:

- jsPDF `2.5.1`: `https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js`
- jsPDF AutoTable `3.5.31`: `https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.31/jspdf.plugin.autotable.min.js`

Before merging a release that must vendor the full upstream libraries, replace the local adapters with the official upstream distribution files and keep this README updated with exact versions, source URLs, and license text/links.
