FROM docker.io/library/nginx:stable

LABEL purpose="ROADMOCKER"

WORKDIR /usr/share/nginx/html

COPY rsu-simulator /usr/share/nginx/html
COPY test_data.tar.gz /usr/share/nginx/html/
COPY rsu-simulator/deploy/default.conf /etc/nginx/conf.d/default.conf

RUN mkdir test-data
RUN tar zxvf test_data.tar.gz -C test-data && chmod 644 test-data/*.json && rm -rf test-data/.*json* && rm -rf test-data/.*DS_Store*
RUN ls test-data/* | awk '{print $1 " <br/>"}' > test-data/index.html
