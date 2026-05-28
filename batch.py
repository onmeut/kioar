import boto3

s3 = boto3.client("s3", region_name="eu-west-1")

# Create buckets
s3.create_bucket(Bucket="kioar-bedrock-input", CreateBucketConfiguration={"LocationConstraint": "eu-west-1"})
s3.create_bucket(Bucket="kioar-bedrock-output", CreateBucketConfiguration={"LocationConstraint": "eu-west-1"})

# Upload input file
s3.upload_file("input.jsonl", "kioar-bedrock-input", "input.jsonl")
print("✅ File uploaded to S3")
