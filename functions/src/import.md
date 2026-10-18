# Source importing

The importer accepts public HTTP(S) article and PDF links. It rejects credentials, ports other than 80 and 443, private, loopback, multicast, reserved, and mapped private addresses. DNS results are pinned to the checked addresses for each connection; every redirect repeats validation. Downloads have byte and time limits. arXiv abstract links resolve to the full PDF. Shared Google Doc links resolve to the document's PDF export, and the download file name is returned in `X-Source-Filename` so the reading keeps the document's title. A redirect to a Google sign-in page reports that the file is private instead of importing the login page.

Readability extracts the article. Source scripts never execute, and the app renders text rather than source HTML. Unreadable, protected, and blocked pages report failures. PDF extraction and scanned-page OCR run in the browser, retaining page numbers. Original PDF bytes are not sent to AI; questions send extracted text.
