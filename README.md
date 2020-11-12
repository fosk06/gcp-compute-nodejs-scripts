# gcp-compute-scripts

script to build and run a node.js Application on GCP compute

```sh
gcloud compute instances create nodejs-app \
    --image-family debian-10 \
    --image-project debian-cloud \
    --machine-type n1-standard-1 \
    --scopes "userinfo-email,cloud-platform" \
    --metadata startup-script-url=<mybucket>/setup.sh \
    --zone europe-west1-c \
    --service-account=<service-account>
```
