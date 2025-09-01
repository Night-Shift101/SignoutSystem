class PDFGenerator {
    constructor(app) {
        this.app = app;
    }

    /**
     * Generates a PDF report for a sign-out record
     * @param {Object} signOutData - The sign-out data to include
     * @returns {{ success: boolean, error: string|null, data?: string }}
     */
    async generateSignOutPDF(signOutData) {
        try {
        // Check if jsPDF library is available
        if (!window.jspdf?.jsPDF) {
            console.error('jsPDF library not loaded');
            this.showError('PDF library not available');
            return { success: false, error: 'PDF library not loaded' };
        }

        try {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            
            // Set up PDF document
            this.addPDFHeader(doc, signOutData);
            let yPosition = this.addBasicInformation(doc, signOutData, 50);
            yPosition = this.addPersonnelList(doc, signOutData, yPosition + 10);
            yPosition = this.addDetailsSection(doc, signOutData, yPosition + 10);
            yPosition = this.addTimelineSection(doc, signOutData, yPosition + 10);
            this.addPDFFooter(doc);

            // Generate filename
            const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
            const filename = `sign-out-${signOutData.id}-${timestamp}.pdf`;

            return {
                success: true,
                error: null,
                data: { pdf: doc, filename }
            };
        } catch (error) {
            console.error('PDF generation error:', error);
            return {
                success: false,
                error: error?.message || 'Failed to generate PDF',
                data: null
            };
        }
    }

    addPDFHeader(pdf, data) {
        // Set title
        pdf.setFontSize(20);
        pdf.setFont('helvetica', 'bold');
        pdf.text('SIGN-OUT REPORT', 105, 20, { align: 'center' });
        
        // Set subtitle
        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'normal');
        pdf.text(`Generated: ${new Date().toLocaleString()}`, 105, 30, { align: 'center' });
        
        // Add line separator
        pdf.setLineWidth(0.5);
        pdf.line(20, 35, 190, 35);
    }

    addBasicInformation(pdf, data, yPos) {
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.text('📋 BASIC INFORMATION', 20, yPos);
        
        yPos += 8;
        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'normal');
        
        const basicInfo = [
            `Sign-Out ID: #${data.id}`,
            `Date/Time: ${this.formatDateTime(data.sign_out_time)}`,
            `Location: ${data.location}`,
            `Status: ${data.sign_in_time ? 'Returned' : 'Currently Out'}`,
            `Authorized By: ${data.signed_out_by || 'N/A'}`
        ];
        
        basicInfo.forEach(info => {
            pdf.text(`• ${info}`, 25, yPos);
            yPos += 6;
        });
        
        return yPos;
    }

    addPersonnelList(pdf, data, yPos) {
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.text(`👥 PERSONNEL (${data.soldiers_count || 0} soldiers)`, 20, yPos);
        
        yPos += 8;
        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'normal');
        
        if (data.soldiers && Array.isArray(data.soldiers)) {
            data.soldiers.forEach(soldier => {
                const soldierInfo = `• ${soldier.rank || ''} ${soldier.full_name || soldier.name || 'Unknown'}`;
                if (soldier.dodid) {
                    pdf.text(`${soldierInfo} (ID: ${soldier.dodid})`, 25, yPos);
                } else {
                    pdf.text(soldierInfo, 25, yPos);
                }
                yPos += 6;
            });
        } else if (data.soldiers_display) {
            // Handle cases where soldiers are in display format
            const soldierNames = data.soldiers_display.split(', ');
            soldierNames.forEach(name => {
                pdf.text(`• ${name}`, 25, yPos);
                yPos += 6;
            });
        } else {
            pdf.text('• No personnel information available', 25, yPos);
            yPos += 6;
        }
        
        return yPos;
    }

    addDetailsSection(pdf, data, yPos) {
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.text('📝 DETAILS', 20, yPos);
        
        yPos += 8;
        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'normal');
        
        const details = [
            `Notes: ${data.notes || 'None'}`,
            `Location Options: ${this.formatLocationOptions(data.location_options)}`,
            `Estimated Return: ${data.estimated_return ? this.formatDateTime(data.estimated_return) : 'Not specified'}`
        ];
        
        details.forEach(detail => {
            // Handle long text wrapping
            const lines = pdf.splitTextToSize(detail, 165);
            lines.forEach(line => {
                pdf.text(`• ${line}`, 25, yPos);
                yPos += 6;
            });
        });
        
        return yPos;
    }

    addTimelineSection(pdf, data, yPos) {
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.text('📊 TIMELINE', 20, yPos);
        
        yPos += 8;
        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'normal');
        
        const timeline = [
            `Sign-Out: ${this.formatDateTime(data.sign_out_time)}`,
            `Sign-In: ${data.sign_in_time ? this.formatDateTime(data.sign_in_time) : 'Pending'}`,
            `Duration: ${this.calculateDuration(data.sign_out_time, data.sign_in_time)}`
        ];
        
        timeline.forEach(item => {
            pdf.text(`• ${item}`, 25, yPos);
            yPos += 6;
        });
        
        return yPos;
    }

    addPDFFooter(pdf) {
        const pageHeight = pdf.internal.pageSize.height;
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'normal');
        pdf.text('Generated by Soldier Sign-Out System', 105, pageHeight - 15, { align: 'center' });
        pdf.text(`Page 1 of 1`, 105, pageHeight - 10, { align: 'center' });
    }

    formatDateTime(dateString) {
        if (!dateString) return 'N/A';
        try {
            return new Date(dateString).toLocaleString();
        } catch (error) {
            return dateString;
        }
    }

    formatLocationOptions(options) {
        if (!options) return 'None';
        if (Array.isArray(options)) {
            return options.join(', ') || 'None';
        }
        if (typeof options === 'string') {
            try {
                const parsed = JSON.parse(options);
                return Array.isArray(parsed) ? parsed.join(', ') : options;
            } catch {
                return options;
            }
        }
        return 'None';
    }

    calculateDuration(signOutTime, signInTime) {
        if (!signOutTime) return 'N/A';
        
        const startTime = new Date(signOutTime);
        const endTime = signInTime ? new Date(signInTime) : new Date();
        
        const diffMs = endTime - startTime;
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        
        if (diffHours > 0) {
            return `${diffHours}h ${diffMinutes}m`;
        } else {
            return `${diffMinutes}m`;
        }
    }

    /**
     * Downloads the generated PDF
     * @param {Object} pdfData - The PDF data from generateSignOutPDF
     */
    downloadPDF(pdfData) {
        try {
            const { pdf, filename } = pdfData;
            pdf.save(filename);
            
            if (this.app.notificationManager) {
                this.app.notificationManager.showNotification('PDF downloaded successfully', 'success');
            }
        } catch (error) {
            console.error('PDF download error:', error);
            if (this.app.notificationManager) {
                this.app.notificationManager.showNotification('Failed to download PDF', 'error');
            }
        }
    }
}

export default PDFGenerator;
