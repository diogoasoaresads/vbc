# Utiliza a imagem oficial do Node.js (versão slim baseada em Debian)
FROM node:18-slim

# Define o diretório de trabalho dentro do container
WORKDIR /app

# Copia os arquivos de definição de pacotes
COPY package.json ./

# Instala apenas as dependências de produção
RUN npm install --production

# Copia o restante dos arquivos do projeto
COPY . .

# Cria o diretório de dados para persistência do banco JSON
RUN mkdir -p /app/data

# Define a porta padrão exposta pelo container
EXPOSE 3000

# Define a variável de ambiente para produção
ENV NODE_ENV=production
ENV PORT=3000

# Comando para iniciar o servidor
CMD ["npm", "start"]
