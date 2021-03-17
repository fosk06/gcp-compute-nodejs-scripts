#!/bin/bash

# install node js
apt-get update -y
apt-get upgrade -y

# install nodejs
apt-get install curl git build-essential -y
curl -sL https://deb.nodesource.com/setup_14.x | bash -
apt-get update -y
apt-get install nodejs -y


# clean
apt-get clean
cat /dev/null > ~/.bash_history

# create node user if not existing
useradd node

# switch user
su node

# move to correct folder
cd /home/node


# download startup script
curl -LJO https://raw.githubusercontent.com/fosk06/gcp-compute-nodejs-scripts/main/startup.js