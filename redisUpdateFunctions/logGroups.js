const logGroups = [
    {
      name: '/aws/lambda/ric-crud-application-dev-ricGet',
      functionSecretManagerKey: 'getFunctionResourcesRediskey',
    },
    // Add other log groups as needed
  ];
  

  module.exports = {
    logGroups
  }; 