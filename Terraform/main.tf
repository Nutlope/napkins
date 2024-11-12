# Configure AWS Provider
provider "aws" {
  region = var.aws_region
}

# Variables
variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "bucket_name" {
  description = "Name of the S3 bucket"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "development"
}

# S3 Bucket
resource "aws_s3_bucket" "upload_bucket" {
  bucket = var.bucket_name

  tags = {
    Environment = var.environment
    Managed_by  = "terraform"
  }
}

# S3 Bucket Public Access Block
resource "aws_s3_bucket_public_access_block" "upload_bucket_public_access" {
  bucket = aws_s3_bucket.upload_bucket.id

  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

# S3 Bucket Policy
resource "aws_s3_bucket_policy" "upload_bucket_policy" {
  bucket = aws_s3_bucket.upload_bucket.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "Statement1"
        Effect    = "Allow"
        Principal = "*"
        Action    = "s3:GetObject"
        Resource  = "${aws_s3_bucket.upload_bucket.arn}/*"
      }
    ]
  })

  depends_on = [aws_s3_bucket_public_access_block.upload_bucket_public_access]
}

# S3 Bucket CORS Configuration
resource "aws_s3_bucket_cors_configuration" "upload_bucket_cors" {
  bucket = aws_s3_bucket.upload_bucket.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["PUT", "POST"]
    allowed_origins = ["*"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}

# IAM User
resource "aws_iam_user" "s3_upload_user" {
  name = "next-s3-upload-user"
  
  tags = {
    Description = "IAM user for Next.js S3 uploads"
    Environment = var.environment
  }
}

# IAM Access Key
resource "aws_iam_access_key" "s3_upload_user_key" {
  user = aws_iam_user.s3_upload_user.name
}

# IAM Policy
resource "aws_iam_policy" "s3_upload_policy" {
  name        = "next-s3-upload-policy"
  description = "Policy for Next.js S3 uploads"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "STSToken"
        Effect = "Allow"
        Action = "sts:GetFederationToken"
        Resource = ["arn:aws:sts::${data.aws_caller_identity.current.account_id}:federated-user/S3UploadWebToken"]
      },
      {
        Sid    = "S3UploadAssets"
        Effect = "Allow"
        Action = "s3:*"
        Resource = [
          aws_s3_bucket.upload_bucket.arn,
          "${aws_s3_bucket.upload_bucket.arn}/*.jpg",
          "${aws_s3_bucket.upload_bucket.arn}/*.jpeg",
          "${aws_s3_bucket.upload_bucket.arn}/*.png",
          "${aws_s3_bucket.upload_bucket.arn}/*.gif"
        ]
      }
    ]
  })
}

# Attach policy to user
resource "aws_iam_user_policy_attachment" "s3_upload_user_policy" {
  user       = aws_iam_user.s3_upload_user.name
  policy_arn = aws_iam_policy.s3_upload_policy.arn
}

# Data source for AWS account ID
data "aws_caller_identity" "current" {}

# Outputs
output "S3_UPLOAD_BUCKET" {
  description = "Name of the created S3 bucket"
  value       = aws_s3_bucket.upload_bucket.id
}

output "S3_UPLOAD_REGION" {
  description = "AWS region where the bucket is created"
  value       = var.aws_region
}

output "S3_UPLOAD_KEY" {
  description = "AWS access key ID for the IAM user"
  value       = aws_iam_access_key.s3_upload_user_key.id
}

output "S3_UPLOAD_SECRET" {
  description = "AWS secret access key for the IAM user"
  value       = aws_iam_access_key.s3_upload_user_key.secret
  sensitive   = true
}

output "bucket_arn" {
  description = "ARN of the created S3 bucket"
  value       = aws_s3_bucket.upload_bucket.arn
}

output "iam_user_arn" {
  description = "ARN of the created IAM user"
  value       = aws_iam_user.s3_upload_user.arn
}
