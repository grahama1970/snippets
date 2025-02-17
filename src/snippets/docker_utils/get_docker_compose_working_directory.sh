#!/bin/bash

# Get Working Directory of a Docker Compose Project
# This script retrieves the working directory where a docker-compose project was launched from.
# It's useful when you need to know the original working directory but might have forgotten
# where you ran docker-compose from. The script inspects the container's configuration
# to get the "com.docker.compose.project.working_dir" label which stores this information.

CONTAINER_NAME="arangodb"
docker inspect "$CONTAINER_NAME" --format '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}'

# Outputs
# /home/grahama/workspace/experiments/tools/aql_query_tool/src/search_tool/docker_utils