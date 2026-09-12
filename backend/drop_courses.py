import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

engine = create_async_engine('sqlite+aiosqlite:///./attendance.db')

async def drop():
    async with engine.begin() as conn:
        await conn.execute(text('DROP TABLE courses'))

asyncio.run(drop())
