import { useEffect, useRef, useState } from "react";
import { Box, Button, Stack, Typography } from "@mui/material";
import {
  GlobalWorkerOptions,
  getDocument,
  type PDFDocumentProxy,
} from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { Version } from "./types";
import { ErrorNotice, Loading } from "./ui";
GlobalWorkerOptions.workerSrc = workerUrl;
function PdfPreview({ url }: { url: string }) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null),
    [page, setPage] = useState(1),
    [error, setError] = useState(""),
    [rendering, setRendering] = useState(false),
    canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let cancelled = false;
    setPdf(null);
    setPage(1);
    setError("");
    const task = getDocument({ url });
    void task.promise
      .then((value) => {
        if (!cancelled) setPdf(value);
      })
      .catch(() => {
        if (!cancelled)
          setError(
            "The PDF preview could not load. Download the original file to open it.",
          );
      });
    return () => {
      cancelled = true;
      void task.destroy();
    };
  }, [url]);
  useEffect(() => {
    if (!pdf) return;
    let cancelled = false;
    let job: { cancel: () => void } | undefined;
    setRendering(true);
    void pdf
      .getPage(page)
      .then((value) => {
        if (cancelled || !canvas.current) return;
        const viewport = value.getViewport({ scale: 1.5 }),
          target = canvas.current;
        target.width = viewport.width;
        target.height = viewport.height;
        const render = value.render({ canvas: target, viewport });
        job = render;
        return render.promise;
      })
      .catch((e: Error) => {
        if (!cancelled && e.name !== "RenderingCancelledException")
          setError(
            "The PDF page could not render. Download the original file to open it.",
          );
      })
      .finally(() => {
        if (!cancelled) setRendering(false);
      });
    return () => {
      cancelled = true;
      job?.cancel();
    };
  }, [pdf, page]);
  return (
    <Box>
      <ErrorNotice error={error} />
      {!pdf && !error && <Loading label="Loading PDF…" />}
      {pdf && (
        <>
          <Stack
            direction="row"
            spacing={1}
            sx={{ alignItems: "center", mb: 1.5 }}
          >
            <Button
              disabled={page <= 1 || rendering}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous page
            </Button>
            <Typography variant="caption">
              Page {page} of {pdf.numPages}
            </Typography>
            <Button
              disabled={page >= pdf.numPages || rendering}
              onClick={() => setPage((p) => p + 1)}
            >
              Next page
            </Button>
          </Stack>
          <Box
            sx={{
              border: 1,
              borderColor: "divider",
              bgcolor: "#fff",
              overflow: "hidden",
            }}
          >
            <canvas
              ref={canvas}
              role="img"
              aria-label={`PDF page ${page}`}
              style={{ display: "block", width: "100%", height: "auto" }}
            />
          </Box>
        </>
      )}
    </Box>
  );
}
export function FilePreview({ file }: { file: Version | undefined }) {
  const docx = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (file?.url && file.type !== "application/pdf" && docx.current) {
      if (window.previewDocx) void window.previewDocx(file.url, docx.current);
      else
        docx.current.textContent =
          "Download the original document to view its contents.";
    }
  }, [file?.url, file?.type]);
  if (!file || file.unavailable || !file.url)
    return (
      <Typography color="text.secondary">
        The file is unavailable. Refresh the resource to try again.
      </Typography>
    );
  return file.type === "application/pdf" ? (
    <PdfPreview key={file.url} url={file.url} />
  ) : (
    <Box
      ref={docx}
      role="region"
      aria-label="Document text preview"
      sx={{
        border: 1,
        borderColor: "divider",
        p: { xs: 2, sm: 3 },
        borderRadius: 1,
        whiteSpace: "pre-wrap",
        overflowWrap: "anywhere",
        lineHeight: 1.8,
        fontSize: 13,
        maxHeight: 720,
        overflowY: "auto",
      }}
    />
  );
}
