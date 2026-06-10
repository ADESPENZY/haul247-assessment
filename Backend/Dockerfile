# ── Base image ───────────────────────────────────────────────────────────────
FROM php:8.4-apache

# ── System packages ───────────────────────────────────────────────────────────
# libonig-dev   → mbstring
# libzip-dev    → zip
# libicu-dev    → intl
# libpng-dev    → gd (PNG)
# libjpeg-dev   → gd (JPEG)
# libfreetype6-dev → gd (fonts)
# libssl-dev    → openssl (already bundled in PHP, but needed for compile flags)
# git unzip curl → composer runtime deps
RUN apt-get update && apt-get install -y --no-install-recommends \
        git \
        curl \
        unzip \
        libonig-dev \
        libzip-dev \
        libicu-dev \
        libpng-dev \
        libjpeg-dev \
        libfreetype6-dev \
    && rm -rf /var/lib/apt/lists/*

# ── PHP extensions ────────────────────────────────────────────────────────────
RUN docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install -j"$(nproc)" \
        pdo_mysql \
        mbstring \
        exif \
        pcntl \
        bcmath \
        gd \
        zip \
        intl \
        opcache

# ── Apache configuration ──────────────────────────────────────────────────────
RUN a2enmod rewrite

# Replace the default vhost so DocumentRoot points to Laravel's public/ dir
COPY docker/apache.conf /etc/apache2/sites-available/000-default.conf

# ── Composer ──────────────────────────────────────────────────────────────────
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

# ── Install PHP dependencies (own layer — rebuilds only when lock file changes)
COPY composer.json composer.lock ./
RUN composer install \
        --optimize-autoloader \
        --no-scripts \
        --no-interaction

# ── Copy application source ────────────────────────────────────────────────────
# .dockerignore excludes: vendor/ .env .env.* database/database.sqlite storage/logs/*.log
COPY . .

# ── Storage permissions ───────────────────────────────────────────────────────
RUN chown -R www-data:www-data \
        /var/www/html/storage \
        /var/www/html/bootstrap/cache \
    && chmod -R 775 \
        /var/www/html/storage \
        /var/www/html/bootstrap/cache

EXPOSE 80

# Default CMD — overridden by docker-compose.yml to run migrations first
CMD ["apache2-foreground"]
