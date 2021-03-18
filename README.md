# gcp-compute-scripts

Opiniated way to deploy any Node.js application on GCP compute engine.
Use Packer tool to build an image with a custom node js script to deploy your application. 
This script is tested with debian 10 image provided by GCP.

## Build the VM

Install Packer and configure it for GCP, see [here](https://www.packer.io/docs/builders/googlecompute)

Build the VM with this command:

```sh
cd packer
packer build -var 'zone=europe-west1-c' -var 'project_id=myproject' --force node.pkr.hcl
```

This will create a debian 10 image with node.js 14 installed and the startup.js script deployed on it.
The script will use some custom metadatas of the virtual machine to deploy and run your application.

## Deploy the VM

The VM have few Metadata to work with the script:
- **GIT_URL**: the git url of the nodejs application, used by git clone command it's mandatory
- GIT_BRANCH: the default branch of the application defaults to "master"
- SKIP_START: if set to "true", skip npm start step, default to false
- APP_ROOT: change the default root path of the application, default to /home/node/app
- STACKDRIVER_AGENT: if set to "true", start the stackdriver agent (must be installed)
- AUTODESTROY: if set to "true", the script will try to destroy the VM after "npm start" command. The service account on the VM must have the permission to delete VMs

```sh
gcloud compute instances create nodejs-app \
    --image-family debian-nodejs \
    --machine-type n2-standard-2 \
    --scopes "userinfo-email,cloud-platform" \
    --metadata startup-script="/home/node/startup.js",GIT_URL=<mandatory git url to clone project>,GIT_BRANCH=main \
    --zone <gcp-zone> \
    --service-account=<service-account>
```
gcloud compute instances create nodejs-app \
    --image-family debian-nodejs \
    --machine-type n2-standard-2 \
    --scopes "userinfo-email,cloud-platform" \
    --zone europe-west1-c \
    --project=prestashop-data-integration
