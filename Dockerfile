FROM heroku/heroku:20

# Define pasta padrão
WORKDIR /home/nodejs/app

# Evitar interação durante instalação dos pacotes
ENV DEBIAN_FRONTEND=noninteractive
# Instala o node 12
RUN curl -sL https://deb.nodesource.com/setup_12.x | bash -
RUN apt -y install nodejs gcc g++ make

# Adiciona novo usuário e grupo para evitar usar o root
RUN groupadd -r nodejs && useradd -m -r -g nodejs -s /bin/bash nodejs

# Copia package.json e instala dependências criando um layer(cache) para ele
COPY package.json .
RUN npm install

# Adicionar arquivos do repositório no container
COPY . .

# Compilar os arquivos do typescript
RUN npm run build

# Remove arquivos desnecesários (Comentar essa linha quando for desenvolver no container)
RUN rm -rf src/app src/assets backend/src && npm prune --production

# Define variáveis de ambiente
ENV  NODE_ENV production

# Corrige permissões da pasta
RUN chmod -Rf 775 /home/nodejs && chown -Rf nodejs:nodejs /home/nodejs

# Passa a usar o novo usuário não root "nodejs"
USER nodejs

# Expor porta 3000
# TODO: Testar variavél de ambiente de porta e selecionar ela caso definida
EXPOSE 3000

# Roda servidor ao dar run na imagem.
CMD ["npm", "run", "start"]