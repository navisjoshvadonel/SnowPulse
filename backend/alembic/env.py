"""
Alembic environment config for SnowPulse.

Location: backend/alembic/env.py
"""
import os
import sys
from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool

from alembic import context

# Make `app` importable when running `alembic` from backend/
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import the models module so every model class registers itself on
# Base.metadata before autogenerate runs. The import is required for its
# side effect only, so it's marked noqa rather than actually unused.
from app import models  # noqa: E402,F401
from app.database import Base  # noqa: E402

config = context.config

# Pull the real DB URL from env at migration time, same variable the app uses.
config.set_main_option(
    "sqlalchemy.url",
    os.getenv("DATABASE_URL", "sqlite:///./snowpulse.db"),
)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
