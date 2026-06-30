import uuid
from datetime import datetime

from fpdf import FPDF

from ...logging_config import logger
from ...storage.service import storage_service


class ExecutivePDF(FPDF):
    def __init__(self, title_str: str = "Executive Report"):
        super().__init__()
        self.title_str = title_str

    def header(self):
        # Draw top banner line
        self.set_font("helvetica", "B", 8)
        self.set_text_color(80, 90, 105)
        page_width = self.w - self.l_margin - self.r_margin
        self.cell(page_width / 2, 8, f"SNOW INTELLIGENCE LAYER  |  {self.title_str.upper()}", align="L")
        self.set_font("helvetica", "", 8)
        self.cell(page_width / 2, 8, datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC"), align="R")
        self.ln(8)
        self.draw_header_divider()
        self.ln(6)

    def footer(self):
        self.set_y(-18)
        self.draw_footer_divider()
        self.set_font("helvetica", "I", 8)
        self.set_text_color(140, 140, 140)
        self.cell(0, 8, "CONFIDENTIAL  -  FOR INTERNAL USE ONLY", ln=0, align="L")
        self.cell(0, 8, f"Page {self.page_no()}/{{nb}}", ln=1, align="R")

    def draw_header_divider(self):
        self.set_draw_color(31, 41, 55) # Sleek slate dark
        self.set_line_width(0.5)
        self.line(self.get_x(), self.get_y(), self.w - self.r_margin, self.get_y())

    def draw_footer_divider(self):
        self.set_draw_color(220, 225, 230)
        self.set_line_width(0.3)
        self.line(self.get_x(), self.get_y(), self.w - self.r_margin, self.get_y())

class ReportGenerator:
    @staticmethod
    def compile_markdown_to_pdf(markdown_text: str, title: str) -> bytes:
        """
        Parses structured Markdown string and formats it into standard Executive PDF.
        """
        pdf = ExecutivePDF(title_str=title)
        pdf.alias_nb_pages()
        pdf.add_page()
        pdf.set_auto_page_break(auto=True, margin=20)

        pdf.set_font("helvetica", "B", 24)
        pdf.set_text_color(17, 24, 39) # Very dark slate
        pdf.cell(0, 15, title, align="L")
        pdf.ln(15)

        pdf.set_font("helvetica", "", 10)
        pdf.set_text_color(107, 114, 128) # Grey
        pdf.cell(0, 6, f"Generated autonomously by SNOW Phase 4 AI Orchestrator on {datetime.utcnow().strftime('%B %d, %Y')}", align="L")
        pdf.ln(16)

        # Parse and write lines
        lines = markdown_text.split("\n")
        in_code_block = False

        for line in lines:
            stripped = line.strip()

            # Code block toggles
            if stripped.startswith("```"):
                in_code_block = not in_code_block
                continue

            if in_code_block:
                pdf.set_font("courier", "", 9)
                pdf.set_text_color(31, 41, 55)
                pdf.multi_cell(0, 5, line, new_x="LMARGIN", new_y="NEXT")
                continue

            # Heading 1
            if stripped.startswith("# "):
                pdf.ln(4)
                pdf.set_font("helvetica", "B", 16)
                pdf.set_text_color(17, 24, 39)
                pdf.multi_cell(0, 10, stripped[2:], new_x="LMARGIN", new_y="NEXT")
                pdf.ln(2)

            # Heading 2
            elif stripped.startswith("## "):
                pdf.ln(3)
                pdf.set_font("helvetica", "B", 13)
                pdf.set_text_color(31, 41, 55)
                pdf.multi_cell(0, 8, stripped[3:], new_x="LMARGIN", new_y="NEXT")
                pdf.ln(1)

            # Heading 3
            elif stripped.startswith("### "):
                pdf.ln(2)
                pdf.set_font("helvetica", "B", 11)
                pdf.set_text_color(55, 65, 81)
                pdf.multi_cell(0, 7, stripped[4:], new_x="LMARGIN", new_y="NEXT")
                pdf.ln(1)

            # Bullets
            elif stripped.startswith("- ") or stripped.startswith("* "):
                pdf.set_font("helvetica", "", 10)
                pdf.set_text_color(31, 41, 55)
                bullet_text = stripped[2:]

                # Check for bold parts within bullet
                pdf.multi_cell(0, 6, f"  *  {bullet_text}", new_x="LMARGIN", new_y="NEXT")

            # Regular lines
            else:
                if stripped == "":
                    pdf.ln(3)
                else:
                    pdf.set_font("helvetica", "", 10)
                    pdf.set_text_color(31, 41, 55)
                    pdf.multi_cell(0, 6, stripped, new_x="LMARGIN", new_y="NEXT")

        return pdf.output()

    @staticmethod
    async def generate_and_upload_report(
        markdown_content: str,
        report_type: str,
        user_id: int,
        dataset_id: int = None
    ) -> tuple[str, str]:
        """
        Builds the PDF, uploads to MinIO 'reports' bucket, and returns object path + presigned URL.
        """
        title = f"{report_type.replace('_', ' ').title()} Intelligence Report"
        pdf_bytes = ReportGenerator.compile_markdown_to_pdf(markdown_content, title)

        # Generate unique file name
        unique_id = uuid.uuid4().hex
        filename = f"report_{user_id}_{unique_id}.pdf"

        # Upload using storage_service
        logger.info(f"Uploading report PDF: {filename} to MinIO...")
        object_path = storage_service.upload_file(
            bucket_name="reports",
            object_name=filename,
            data=pdf_bytes,
            content_type="application/pdf",
            metadata={
                "UserId": str(user_id),
                "ReportType": report_type,
                "DatasetId": str(dataset_id or "")
            }
        )

        # Generate presigned URL (1 hour expiration)
        presigned_url = storage_service.get_signed_url(
            bucket_name="reports",
            object_name=filename,
            expires_in_seconds=3600
        )

        logger.info(f"Report uploaded successfully. Path: {object_path}")
        return object_path, presigned_url
