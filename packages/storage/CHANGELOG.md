# @lagomkit/storage

## 1.1.0

### Minor Changes

- 5b401c8: Add a typed storage service with interchangeable local filesystem and lightweight s3mini drivers. Support streams, metadata, transfers, directory listings, and S3 signed download and upload URLs, with explicit errors for unsupported operations.
  
  Leave access permissions to application and infrastructure configuration, without object ACL headers or ACL management methods.
