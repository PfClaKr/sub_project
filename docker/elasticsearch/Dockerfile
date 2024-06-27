FROM elasticsearch:7.17.18

RUN	elasticsearch-plugin install analysis-nori

COPY ./config/elasticsearch.yml /usr/share/elasticsearch/config/elasticsearch.yml

# COPY ./scripts/nori_index.sh /usr/share/elasticsearch/scripts/nori_index.sh
# RUN chmod +x /usr/share/elasticsearch/scripts/nori_index.sh

# CMD ["sh", "-c", "elasticsearch & sleep 30 && /usr/share/elasticsearch/scripts/nori_index.sh && fg"]