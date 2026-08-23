# Development infrastructure

The root `docker-compose.yml` owns the local PostgreSQL and Redis services. Application containers are intentionally omitted so local Next.js and NestJS hot reload remain fast and easy to debug.

Persistent development data is stored in the named volumes `crown_postgres_data` and `crown_redis_data`.
