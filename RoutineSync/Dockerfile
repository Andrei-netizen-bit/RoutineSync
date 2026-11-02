
FROM php:8.2-apache

# Install trusted root certificates
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install PHP database extensions
RUN docker-php-ext-install pdo pdo_mysql

# Enable Apache rewrite
RUN a2enmod rewrite

# Copy project files
COPY . /var/www/html/

EXPOSE 80
