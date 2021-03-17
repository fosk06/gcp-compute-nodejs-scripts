variable "zone" {
  type    = string
}
variable  project_id{
  type    = string
}


source "googlecompute" "compute" {
  disk_size           = "20"
  disk_type           = "pd-ssd"
  image_description   = "debian with node js"
  image_family        = "debian-nodejs"
  image_name          = "debian-nodejs"
  machine_type        = "n2-standard-1"
  project_id          = var.project_id
  source_image_family = "debian-10"
  ssh_username        = "packer"
  zone                = var.zone
}

build {
  sources = ["source.googlecompute.compute"]

  provisioner "file" {
    destination = "/tmp/setup.sh"
    source      = "./setup.sh"
  }

  provisioner "shell" {
    inline = [
        "chmod +x /tmp/setup.sh", 
        "sudo bash /tmp/setup.sh"
    ]
  }

}