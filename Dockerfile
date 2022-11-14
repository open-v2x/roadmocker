FROM docker.io/library/nginx:stable

LABEL purpose="ROADMOCKER"

WORKDIR /usr/share/nginx/html

COPY . /usr/share/nginx/html
COPY deploy/default.conf /etc/nginx/conf.d/default.conf

RUN mkdir test-data
RUN mkdir radar-test-data
RUN tar zxvf test_data.tar.gz -C test-data && chmod 644 test-data/*.json && rm -rf test-data/.*json* && rm -rf test-data/.*DS_Store*
RUN tar zxvf radar_test_data.tar.gz -C radar-test-data && chmod 644 radar-test-data/*.json && rm -rf radar-test-data/.*json*
RUN ls test-data/* | awk '{print $1 " <br/>"}' > test-data/index.html
