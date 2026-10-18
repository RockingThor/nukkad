# Deploying Nukkad to AWS

Everything runs in one Lambda behind a Function URL, with one DynamoDB table in on demand mode.

## First time

```bash
aws iam create-role --role-name nukkad-lambda-role --assume-role-policy-document file://trust.json
aws iam attach-role-policy --role-name nukkad-lambda-role --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
aws iam put-role-policy --role-name nukkad-lambda-role --policy-name nukkad-ddb --policy-document file://ddb.json
aws dynamodb create-table --table-name nukkad \
  --attribute-definitions AttributeName=pk,AttributeType=S AttributeName=sk,AttributeType=S \
  --key-schema AttributeName=pk,KeyType=HASH AttributeName=sk,KeyType=RANGE --billing-mode PAY_PER_REQUEST
./deploy/bundle.sh
aws lambda create-function --function-name nukkad --runtime nodejs22.x --architectures arm64 \
  --handler index.handler --memory-size 1024 --timeout 29 \
  --role arn:aws:iam::<account>:role/nukkad-lambda-role --zip-file fileb://deploy/build/nukkad.zip \
  --environment file://env.json   # NUKKAD_TABLE, NUKKAD_STATIC_DIR=/var/task/public, DEEPSEEK_API_KEY
aws lambda create-function-url-config --function-name nukkad --auth-type NONE
aws lambda add-permission --function-name nukkad --statement-id url --action lambda:InvokeFunctionUrl \
  --principal '*' --function-url-auth-type NONE
aws lambda add-permission --function-name nukkad --statement-id url-invoke --action lambda:InvokeFunction \
  --principal '*' --invoked-via-function-url
curl -X POST <function-url>/api/reset   # seed the demo data
```

## Updates

```bash
./deploy/deploy.sh
```
