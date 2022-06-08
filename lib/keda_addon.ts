// lib/kubevious_addon.ts
import { Construct } from 'constructs';
import { ManagedPolicy } from "aws-cdk-lib/aws-iam";
import merge from "ts-deepmerge";
import * as blueprints from '@aws-quickstart/eks-blueprints';
import { setPath } from '@aws-quickstart/eks-blueprints/dist/utils/object-utils';
import { ClusterInfo, Values } from "@aws-quickstart/eks-blueprints/dist/spi";
import { createNamespace } from '@aws-quickstart/eks-blueprints/dist/utils/namespace-utils';

/**
 * User provided options for the Helm Chart
 */
export interface KedaAddOnProps extends blueprints.HelmAddOnUserProps {
    /**
     * Version of the helm chart to deploy
     */    
    version?: string,
    /**
     * Name of the KEDA operator
     */
    kedaOperatorName?: string,
    /**
     * Specifies whether a service account should be created by keda. If provided false, CDK will create Service Account wth IAM Roles (IRSA). 
     */
    createServiceAccount?: boolean,
    /**
     * The name of the service account to use. If not set and create is true, a name is generated.
     */
    kedaServiceAccountName?: string,
    /**
     * securityContext: fsGroup
     * Check the workaround for SQS Scalar with IRSA https://github.com/kedacore/keda/issues/837#issuecomment-789037326
     */   
    podSecurityContextFsGroup?: number,
    /**
     * securityContext:runAsUser
     * Check the workaround for SQS Scalar with IRSA https://github.com/kedacore/keda/issues/837#issuecomment-789037326
     */   
    securityContextRunAsGroup?: number,
    /**
     * securityContext:runAsGroup
     * Check the workaround for SQS Scalar with IRSA https://github.com/kedacore/keda/issues/837#issuecomment-789037326
     */
    securityContextRunAsUser?: number,
    /**
     * An array of MAnaged IAM Roles which Sercice Account needs for IRSA Eg: irsaRoles:["CloudWatchFullAccess","AmazonSQSFullAccess"]
     */   
    irsaRoles?: string[]
}

/**
 * Default props to be used when creating the Helm chart
 */
const defaultProps: blueprints.HelmAddOnProps & KedaAddOnProps = {
  name: "blueprints-keda-addon",
  chart: "keda",
  namespace:"keda",
  version: "2.7.1",
  release: "keda",
  repository:  "https://kedacore.github.io/charts",
  values: {},
  createServiceAccount: true,
  kedaOperatorName: "keda-operator",
  kedaServiceAccountName: "keda-operator",
  irsaRoles: ["CloudWatchFullAccess"]
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
    let values: Values = populateValues(this.options);
    values = merge(values, this.props.values ?? {});

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

function setRoles(sa:any, irsaRoles: string[]){
  irsaRoles.forEach((policyName) => {
      const policy = ManagedPolicy.fromAwsManagedPolicyName(policyName);
      sa.role.addManagedPolicy(policy);
    });
}
