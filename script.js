window.onload = function() {
    const exportButton = document.getElementById('exportPdfButton');
    if (exportButton) {
        exportButton.addEventListener('click', async () => {
            const proposalDocument = document.getElementById('proposalDocument');
            if (!proposalDocument) {
                console.error("Proposal document element not found!");
                return;
            }

            console.log("Preparing PDF export with html2canvas...");
            exportButton.disabled = true;
            exportButton.textContent = "Exporting...";

            // Hide the button itself during capture
            const buttonContainer = document.querySelector('.export-button-container');
            if (buttonContainer) buttonContainer.style.display = 'none';

            try {
                const canvas = await html2canvas(proposalDocument, {
                    scale: 2.5, // Increased scale for better resolution
                    useCORS: true,
                    logging: true,
                    scrollX: 0,
                    scrollY: -window.scrollY, // Ensure capture from top
                    windowWidth: proposalDocument.scrollWidth,
                    windowHeight: proposalDocument.scrollHeight,
                    onclone: (clonedDoc) => {
                        // Remove the export button from the cloned document before capture
                        const clonedButtonContainer = clonedDoc.querySelector('.export-button-container');
                        if (clonedButtonContainer) clonedButtonContainer.remove();
                    }
                });

                const imgData = canvas.toDataURL('image/png');
                const { jsPDF } = window.jspdf;

                const pdf = new jsPDF({
                    orientation: 'p',
                    unit: 'pt',
                    format: 'a4'
                });

                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pdfHeight = pdf.internal.pageSize.getHeight();

                const margin = 40; // Approx 14mm margin
                const contentWidth = pdfWidth - (2 * margin);
                const contentHeight = pdfHeight - (2 * margin);

                const canvasWidth = canvas.width;
                const canvasHeight = canvas.height;
                const canvasAspectRatio = canvasWidth / canvasHeight;

                // Calculate image dimensions in PDF to fit contentWidth
                let imgPdfWidth = contentWidth;
                let imgPdfHeight = imgPdfWidth / canvasAspectRatio;

                // --- Smarter Page Slicing Logic ---
                // Estimate an average line height in the source canvas.
                // This is a heuristic. A typical line height might be around 1.5 * font-size.
                // If base font size is ~16px on screen, at scale 2.5, it's 40px in canvas.
                // Line height could be ~60px in canvas.
                const ESTIMATED_LINE_HEIGHT_PX_IN_CANVAS = 60; // ADJUST THIS HEURISTIC
                const PAGE_BREAK_AVOID_MARGIN_PX = ESTIMATED_LINE_HEIGHT_PX_IN_CANVAS / 2; // Don't break too close to a line

                let currentSrcY = 0; // Current Y position on the source canvas (in canvas pixels)
                const totalSrcHeightToProcess = canvasHeight;

                while (currentSrcY < totalSrcHeightToProcess) {
                    // Max height for this slice in source canvas pixels
                    let maxSliceHeightSrcPx = contentHeight * (canvasHeight / imgPdfHeight);

                    let sliceEndY = currentSrcY + maxSliceHeightSrcPx;

                    // If this slice would go beyond the total canvas height, cap it.
                    if (sliceEndY > totalSrcHeightToProcess) {
                        sliceEndY = totalSrcHeightToProcess;
                    } else {
                        // Try to find a "safer" break point by looking backwards from the ideal cut.
                        // We don't want to cut in the middle of our estimated line.
                        // This part is tricky and imperfect.
                        // We're essentially trying to avoid breaking if the cut is too close to a multiple of line height.
                        let potentialCutY = sliceEndY;
                        let remainder = potentialCutY % ESTIMATED_LINE_HEIGHT_PX_IN_CANVAS;

                        // If the remainder is too small (close to top of line) or too large (close to bottom of line)
                        // try to move the cut.
                        if (remainder < PAGE_BREAK_AVOID_MARGIN_PX || (ESTIMATED_LINE_HEIGHT_PX_IN_CANVAS - remainder) < PAGE_BREAK_AVOID_MARGIN_PX) {
                            // Try to move cut to the nearest "between lines" spot.
                            // If remainder is small, move back to previous line end.
                            if (remainder < PAGE_BREAK_AVOID_MARGIN_PX && (potentialCutY - remainder - (ESTIMATED_LINE_HEIGHT_PX_IN_CANVAS / 2)) > currentSrcY) {
                                sliceEndY = potentialCutY - remainder - (ESTIMATED_LINE_HEIGHT_PX_IN_CANVAS / 2) ; // Move back
                                console.log("Adjusted page break backwards");
                            }
                            // If remainder is large, try to move slightly forward (less common to do this aggressively)
                            // else if ((ESTIMATED_LINE_HEIGHT_PX_IN_CANVAS - remainder) < PAGE_BREAK_AVOID_MARGIN_PX) {
                            // sliceEndY = potentialCutY + (ESTIMATED_LINE_HEIGHT_PX_IN_CANVAS - remainder) + (PAGE_BREAK_AVOID_MARGIN_PX /2);
                            // }
                        }
                         // Ensure we don't go beyond the total height
                        if (sliceEndY > totalSrcHeightToProcess) sliceEndY = totalSrcHeightToProcess;
                        // Ensure we don't create an empty slice or go backward
                        if (sliceEndY <= currentSrcY) sliceEndY = currentSrcY + maxSliceHeightSrcPx;
                         if (sliceEndY > totalSrcHeightToProcess) sliceEndY = totalSrcHeightToProcess;

                    }


                    let actualSliceHeightSrcPx = sliceEndY - currentSrcY;

                    if (actualSliceHeightSrcPx <= 0) break; // Safety break if no progress

                    const sliceCanvas = document.createElement('canvas');
                    sliceCanvas.width = canvasWidth;
                    sliceCanvas.height = actualSliceHeightSrcPx;
                    const sliceCtx = sliceCanvas.getContext('2d');

                    sliceCtx.drawImage(canvas,
                        0, currentSrcY,                       // Source X, Y
                        canvasWidth, actualSliceHeightSrcPx,  // Source W, H
                        0, 0,                                 // Dest X, Y
                        canvasWidth, actualSliceHeightSrcPx   // Dest W, H
                    );

                    const sliceImgData = sliceCanvas.toDataURL('image/png');
                    const slicePdfHeight = actualSliceHeightSrcPx * (imgPdfHeight / canvasHeight);

                    pdf.addImage(sliceImgData, 'PNG', margin, margin, imgPdfWidth, slicePdfHeight);

                    currentSrcY += actualSliceHeightSrcPx;

                    if (currentSrcY < totalSrcHeightToProcess) {
                        pdf.addPage();
                    }
                }

                pdf.save('Lemat_Youth_Initiative_Proposal_Visual.pdf');
                console.log("PDF export successful with html2canvas.");

            } catch (error) {
                console.error("Error during PDF generation with html2canvas:", error);
                alert("Error generating PDF. Check the console for details.");
            } finally {
                if (buttonContainer) buttonContainer.style.display = 'block'; // Show button again
                exportButton.disabled = false;
                exportButton.textContent = "Export to PDF";
            }
        });
    } else {
        console.error("Export button not found!");
    }
};
