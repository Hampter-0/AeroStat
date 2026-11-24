export interface DockerHost {
  id: number
  name: string
  address: string
  services: number
}

export interface DockerHostsResponse {
  default_address: string
  hosts: DockerHost[]
}

export interface DockerContainer {
  name: string
  state: string
  status: string
  image: string
}

export interface ContainerList {
  address: string
  containers: DockerContainer[]
}
