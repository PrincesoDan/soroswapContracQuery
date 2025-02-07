FROM subquerynetwork/subql-node-stellar:v4.4.0

# Cambiar a usuario root para instalar el paquete
USER root

# Instalar stellar-sdk globalmente
RUN npm install -g stellar-sdk@13.1.0 

# Volver al usuario node (que es el usuario por defecto de la imagen)
USER node 