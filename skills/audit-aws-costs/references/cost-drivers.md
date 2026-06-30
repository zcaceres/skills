# AWS cost-driver cheat sheet

Resources that **bill while idle** (the ones an audit should always look for),
and notes on where they live. Dollar figures are rough on-demand ballparks for
intuition only — always confirm against Cost Explorer.

## Bills even with zero traffic / nothing "using" it

| Resource | Why it costs | Rough idle cost | Find it |
| --- | --- | --- | --- |
| EBS volumes (incl. detached) | Charged per provisioned GiB-month | ~$0.08–0.10/GiB-mo | `ec2 describe-volumes` |
| EBS snapshots / AMIs | Per GB-month of snapshot storage | ~$0.05/GB-mo | `ec2 describe-snapshots --owner-ids self`, `ec2 describe-images --owners self` |
| Unassociated Elastic IPs | Idle public IPv4 bills hourly | ~$3.6/mo each | `ec2 describe-addresses` (no `AssociationId`) |
| Allocated public IPv4 (any) | All public IPv4 now billed hourly | ~$3.6/mo each | attached to instances/ENIs/NATs |
| NAT gateways | Hourly + per-GB processed | ~$32/mo + data | `ec2 describe-nat-gateways` |
| Load balancers (ALB/NLB/Classic) | Hourly + capacity units | ~$16–20/mo + | `elbv2 describe-load-balancers`, `elb describe-load-balancers` |
| RDS / Aurora instances | Hourly even when no connections | varies, often $$$ | `rds describe-db-instances`, `rds describe-db-clusters` |
| RDS snapshots | Storage per GB-month | ~$0.095/GB-mo | `rds describe-db-snapshots` |
| Stopped EC2 instances | Compute stops, but attached EBS still bills | EBS only | `ec2 describe-instances` (state `stopped`) |
| Provisioned ElastiCache / OpenSearch / Redshift | Hourly per node | $$$ | per-service `describe` |
| S3 storage | Per GB-month + requests | ~$0.023/GB-mo (Standard) | `s3api list-buckets` + CloudWatch `BucketSizeBytes` |
| EKS clusters | Control-plane hourly | ~$73/mo each | `eks list-clusters` |
| Provisioned Kinesis / MSK / Global Accelerator | Hourly | $$$ | per-service `describe` |
| Secrets Manager secrets | Per secret-month | ~$0.40/mo each | `secretsmanager list-secrets` |
| Route 53 hosted zones | Per zone-month | ~$0.50/mo each | `route53 list-hosted-zones` |
| CloudWatch logs (retained) | Storage per GB-month | ~$0.03/GB-mo | `logs describe-log-groups` (check retention) |

## Usually free or trivial (don't raise alarms over these)

- IAM users, roles, policies, instance profiles
- Security groups, route tables, subnets, internet gateways, VPCs
- Auto Scaling groups and launch configs/templates themselves (you pay for the
  instances they launch — an ASG with `Desired>0` but `Running=0` is failing to
  launch and costs nothing, but is a cleanup candidate)
- Empty S3 buckets, unused CloudFormation stacks
- Lambda functions at rest (you pay per invocation + duration)

## Scope reminders

- **Per-region** (must sweep every enabled region): EC2, EBS, EIP, NAT, ELB,
  RDS, ASG, CloudFormation, ElastiCache, EKS, most compute/networking.
- **Global**: IAM, Route 53, CloudFront, WAF (global scope), S3 bucket
  namespace (but objects/size are regional and billed per the bucket's region).
- **Cost Explorer** is queried from `us-east-1` regardless of where spend
  occurs; group by `REGION` to localize it.
