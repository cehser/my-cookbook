"""``process_image``: Thumbnail und optimiertes Bild (ohne Datenbank, ohne Netz)."""

from pathlib import Path

import pytest
from PIL import Image

from app.services.images import OPTIMISED_MAX, THUMB_SIZE, process_image


def _make_source(path: Path, size: tuple[int, int], fmt: str, mode: str = "RGB") -> Path:
    Image.new(mode, size, (200, 80, 40, 255) if mode == "RGBA" else (200, 80, 40)).save(path, fmt)
    return path


def _run(tmp_path: Path, src: Path) -> tuple[Path, Path]:
    thumb, optimised = tmp_path / "thumb.webp", tmp_path / "optimised.webp"
    process_image(src, thumb, optimised)
    return thumb, optimised


@pytest.mark.parametrize(
    ("size", "fmt", "mode", "expected_optimised"),
    [
        ((3000, 1500), "JPEG", "RGB", (OPTIMISED_MAX, OPTIMISED_MAX // 2)),
        ((1000, 2400), "PNG", "RGB", (500, OPTIMISED_MAX)),
        ((600, 300), "PNG", "RGBA", (600, 300)),  # kleiner als die Grenze: nicht vergrößern
    ],
)
def test_process_image_sizes_and_format(
    tmp_path: Path,
    size: tuple[int, int],
    fmt: str,
    mode: str,
    expected_optimised: tuple[int, int],
) -> None:
    src = _make_source(tmp_path / f"src.{fmt.lower()}", size, fmt, mode)
    thumb_path, optimised_path = _run(tmp_path, src)

    with Image.open(thumb_path) as thumb:
        assert thumb.format == "WEBP"
        assert max(thumb.size) <= max(THUMB_SIZE)
        assert thumb.size[0] / thumb.size[1] == pytest.approx(size[0] / size[1], rel=0.05)

    with Image.open(optimised_path) as optimised:
        assert optimised.format == "WEBP"
        assert optimised.size == expected_optimised

    assert src.exists(), "Original bleibt unverändert"


def test_process_image_rejects_non_image(tmp_path: Path) -> None:
    src = tmp_path / "kaputt.jpg"
    src.write_bytes(b"kein Bild")
    with pytest.raises(Image.UnidentifiedImageError):
        _run(tmp_path, src)


def test_process_image_applies_exif_orientation(tmp_path: Path) -> None:
    # Querformatige Pixel mit Orientation 6 (90° im Uhrzeigersinn), wie Handy-Hochformatfotos
    src = tmp_path / "hochformat.jpg"
    exif = Image.Exif()
    exif[0x0112] = 6
    Image.new("RGB", (400, 200), (200, 80, 40)).save(src, "JPEG", exif=exif)

    thumb_path, optimised_path = _run(tmp_path, src)

    with Image.open(optimised_path) as optimised:
        assert optimised.size == (200, 400), "aufrecht gedreht"
    with Image.open(thumb_path) as thumb:
        assert thumb.size[0] < thumb.size[1]
