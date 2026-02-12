# PowerShell Script to Setup AWS EC2 Server
$Key = "C:\Users\aosaw\.ssh\ChatApp.pem"
$HostName = "ec2-54-79-204-66.ap-southeast-2.compute.amazonaws.com"
$User = "ec2-user"

# 1. Fix Key Permissions (Windows)
Write-Host "Fixing Key Permissions..."
icacls.exe $Key /reset
icacls.exe $Key /grant:r "$($env:USERNAME):(R)"
icacls.exe $Key /inheritance:r

# 2. Check Connection
Write-Host "Checking SSH Connection..."
ssh -o StrictHostKeyChecking=no -i $Key $User@$HostName "echo 'Connection Successful'"

if ($LASTEXITCODE -eq 0) {
    # 3. Install Docker (Amazon Linux 2023)
    Write-Host "Installing Docker..."
    # Install git and docker
    $InstallCmd = 'sudo yum update -y && sudo yum install -y docker git && sudo service docker start && sudo usermod -aG docker ec2-user'
    
    # Docker Compose Plugin is often included or available via yum
    # Try installing docker-compose-plugin if relevant, or just rely on `docker compose`
    # Fallback to standalone install if `docker compose` fails? 
    # Let's try to install the standalone binary CORRECTLY this time.
    # The previous error "Not: command not found" suggests a 404 or redirect in the curl response.
    # We will use the plugin syntax `docker compose` which is standard now.
    
    ssh -o StrictHostKeyChecking=no -i $Key $User@$HostName "$InstallCmd"

    # 4. Clone and Run
    Write-Host "Deploying App..."
    # Using `docker compose` (V2) instead of `docker-compose` (V1)
    # Also ensure we are in the group so we don't need sudo for docker command (but we might need to re-login)
    # So we use `sudo docker compose` to be safe.
    $DeployCmd = 'rm -rf web-app && git clone https://github.com/AosawnX/Digital-Signature-Chat-Application.git web-app && cd web-app && sudo docker compose up -d --build'
    ssh -o StrictHostKeyChecking=no -i $Key $User@$HostName $DeployCmd
    
    Write-Host "Deployment Complete! API: ws://$HostName"
}
else {
    Write-Host "SSH Connection Failed."
}
