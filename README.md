# gcp-compute-scripts

script to build and run a node.js Application on GCP compute

```sh
# Create a bucket then upload setup.sh script
gsutil cp setup.sh gs://<my-bucket>

# gsutil cp setup.sh gs://compute_artifacts/

```

```sh
gcloud compute instances create nodejs-app \
    --image-family debian-10 \
    --image-project debian-cloud \
    --machine-type <machine-type> \
    --scopes "userinfo-email,cloud-platform" \
    --metadata startup-script-url=<my-bucket>/setup.sh,GIT_URL=<mandatory git url to clone project>,<other custom metadatas> \
    --zone <gcp-zone> \
    --service-account=<service-account>
```
