# Imagem do app web de Projetos Eletricos.
FROM python:3.13-slim

WORKDIR /app

# Dependencias primeiro — aproveita o cache de camada do Docker.
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Codigo da aplicacao.
COPY app.py ./
COPY templates/ ./templates/
COPY static/ ./static/

# Dados persistentes (cookie.txt, snapshot.json) ficam num volume montado aqui.
ENV DATA_DIR=/data
RUN mkdir -p /data

EXPOSE 1289

# Servidor WSGI de producao. 1 processo + varias threads: a app mantem estado
# em memoria (cookie da sessao, thread de keep-alive), entao NAO use multiplos
# processos/workers.
CMD ["waitress-serve", "--listen=0.0.0.0:1289", "--threads=8", "app:app"]
