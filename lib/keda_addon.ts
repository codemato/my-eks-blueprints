// lib/kubevious_addon.ts
import { Construct } from 'constructs';
import { ManagedPolicy } from "aws-cdk-lib/aws-iam";
import * as blueprints from '@aws-quickstart/eks-blueprints';
import { setPath } from '@aws-quickstart/eks-blueprints/dist/utils/object-utils';
import { createNamespace } from '@aws-quickstart/eks-blueprints/dist/utils/namespace-utils';

/**
 * User provided options for the Helm Chart
 */
export interface KedaAddOnProps extends blueprints.HelmAddOnUserProps {
  version?: string,
  namespace?: string,
  kedaOperatorName?: string,
  createServiceAccount?: boolean,
  kedaServiceAccountName?: string,
  podSecurityContextFsGroup?: number,
  securityContextRunAsGroup?: number,
  securityContextRunAsUser?: number,
  irsaRoles?: {}

}

/**
 * Default props to be used when creating the Helm chart
 */
const defaultProps: blueprints.HelmAddOnProps & KedaAddOnProps = {
  name: "blueprints-keda-addon",
  namespace: "keda",
  chart: "keda",
  version: "2.7.1",
  release: "keda",
  repository:  "https://kedacore.github.io/charts",
  values: {},
  createServiceAccount: false,
  kedaOperatorName: "keda-operator",
  kedaServiceAccountName: "keda-operator",
  irsaRoles: {"cloudwatch":"CloudWatchFullAccess"}
};

/**
 * Main class to instantiate the Helm chart
 */
export class KedaAddOn extends blueprints.HelmAddOn {

  readonly options: KedaAddOnProps;

  constructor(props?: KedaAddOnProps) {
    super({...defaultProps, ...props});
    this.options = this.props as KedaAddOnProps;
  }

  deploy(clusterInfo: blueprints.ClusterInfo): Promise<Construct> {
    //Create Service Account with IRSA
    const cluster = clusterInfo.cluster;
    let values: blueprints.Values = populateValues(this.options);
    if(this.options.createServiceAccount === false) {
      const opts = { name: this.options.kedaOperatorName, namespace: this.options.namespace };
      const sa = cluster.addServiceAccount(this.options.kedaServiceAccountName!, opts);
      setRoles(sa,this.options.irsaRoles!)
      const namespace = createNamespace(this.options.namespace! , cluster);
      sa.node.addDependency(namespace);
      
      const chart = this.addHelmChart(clusterInfo, values);
      chart.node.addDependency(sa);
      return Promise.resolve(chart);

    } else {
      const chart = this.addHelmChart(clusterInfo, values);
      return Promise.resolve(chart);
    }
   
    
  }
}

/**
 * populateValues populates the appropriate values used to customize the Helm chart
 * @param helmOptions User provided values to customize the chart
 */
function populateValues(helmOptions: KedaAddOnProps): blueprints.Values {
  const values = helmOptions.values ?? {};
  // Check the workaround for SQS Scalar https://github.com/kedacore/keda/issues/837
  setPath(values, "operator.name",  helmOptions.kedaOperatorName);
  setPath(values, "podSecurityContext.fsGroup",  helmOptions.podSecurityContextFsGroup);
  setPath(values, "securityContext.runAsGroup",  helmOptions.securityContextRunAsGroup);
  setPath(values, "securityContext.runAsUser",  helmOptions.securityContextRunAsUser);
  setPath(values, "serviceAccount.create",  helmOptions.createServiceAccount); 
  setPath(values, "serviceAccount.name",  helmOptions.kedaServiceAccountName); 

  return values;
}

function setRoles(sa:any ,irsaRoles:{}){
  for (let [key, value] of Object.entries(irsaRoles)) {
      const policyName:string = value as string;
      const policy = ManagedPolicy.fromAwsManagedPolicyName(policyName);
      sa.role.addManagedPolicy(policy);
  }
  
}
