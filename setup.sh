#!/bin/bash

## install node js
# update
apt-get update -y

# install nodejs
apt-get install curl git build-essential -y
curl -sL https://deb.nodesource.com/setup_14.x | bash -
apt-get update -y
apt-get install nodejs -y

# clean
apt-get clean
cat /dev/null > ~/.bash_history

# make directories
mkdir -p /home/node/app

# download startup script
curl -LJO https://raw.githubusercontent.com/fosk06/gcp-compute-scripts/master/startup.js /home/node
