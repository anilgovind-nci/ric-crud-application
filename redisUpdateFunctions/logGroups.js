const logGroups = [
    {
      name: '/aws/lambda/ric-crud-application-dev-ricGet',
      functionSecretManagerKey: 'getFunctionResourcesRediskey',
    },
    {
      name: '/aws/lambda/ric-crud-application-dev-ricPost',
      functionSecretManagerKey: 'postFunctionResourcesRediskey',
    },
    {
      name: '/aws/lambda/ric-crud-application-dev-ricPut',
      functionSecretManagerKey: 'putFunctionResourcesRediskey',
    },
    {
      name: '/aws/lambda/ric-crud-application-dev-ricDelete',
      functionSecretManagerKey: 'deleteFunctionResourcesRediskey',
    },
    // Add other log groups as needed
  ];
  

  module.exports = {
    logGroups
  }; 