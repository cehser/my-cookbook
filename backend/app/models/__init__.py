"""Import all models so SQLAlchemy metadata is fully populated."""
from app.models.base import Base  # noqa: F401
from app.models.user import AppUser  # noqa: F401
from app.models.recipe import Recipe  # noqa: F401
from app.models.image import RecipeImage  # noqa: F401
from app.models.favorite import Favorite  # noqa: F401
from app.models.tag import Tag, RecipeTag, RecipeShare  # noqa: F401
