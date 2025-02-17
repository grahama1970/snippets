from datetime import datetime
import subprocess
from pathlib import Path
from loguru import logger


def arango_dump(database: str = "fraud_detection") -> None:
    """Run arangodump via Docker with timestamp directory structure."""
    username = "root"
    password = "openSesame"
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    dump_path = Path("backups") / database / timestamp
    dump_path.mkdir(parents=True, exist_ok=True)
    
    # Create directory in container first
    logger.info("Creating temporary directory in container...")
    subprocess.run(
        f'docker exec arangodb mkdir -p /tmp/{timestamp}/arangodump',
        shell=True, check=True
    )

    # Create dump in container
    logger.info(f"Starting dump of database '{database}'...")
    cmd = f'docker exec arangodb arangodump \
        --server.database {database} \
        --server.username {username} \
        --server.password {password} \
        --output-directory /tmp/{timestamp}/arangodump'
    subprocess.run(cmd, shell=True, check=True)
    
    # Copy from container to host
    logger.info(f"Copying dump from container to {dump_path}...")
    subprocess.run(
        f'docker cp arangodb:/tmp/{timestamp}/arangodump {dump_path}/',
        shell=True, check=True
    )
    
    # Cleanup container directory
    logger.info("Cleaning up temporary files in container...")
    subprocess.run(
        f'docker exec arangodb rm -rf /tmp/{timestamp}',
        shell=True, check=True
    )
    
    logger.info(f"Dump completed successfully at {dump_path}")


def arango_restore(database: str = "fraud_detection") -> None:
    """Restore latest dump from timestamp directory structure."""
    base_path = Path("backups") / database
    latest_dump = sorted(base_path.glob("*"))[-1]
    
    # Copy to container with logging
    try:
        logger.info(f"Copying dump from {latest_dump}/arangodump to container...")
        result = subprocess.run(
            f'docker cp {latest_dump}/arangodump arangodb:/tmp/restore/',
            shell=True,
            check=True,
            capture_output=True,
            text=True
        )
        
        # Verify the files exist in the container
        verify_cmd = subprocess.run(
            'docker exec arangodb ls -la /tmp/restore/arangodump',
            shell=True,
            capture_output=True,
            text=True
        )
        
        if verify_cmd.returncode == 0:
            logger.info(f"Successfully copied dump files to container: \n{verify_cmd.stdout}")
        else:
            raise Exception(f"Files not found in container after copy: {verify_cmd.stderr}")
            
    except subprocess.CalledProcessError as e:
        logger.error(f"Failed to copy dump files to container: {e.stderr}")
        raise

    cmd = f'docker exec arangodb arangorestore \
        --server.database {database} \
        --input-directory /tmp/restore/arangodump \
        --overwrite true \
        --create-database true \
        --create-collections true'
    
    # Restore
    subprocess.run(cmd, shell=True, check=True)




if __name__ == "__main__":
    # arango_restore_v2('verifaix')
    arango_dump('verifaix')