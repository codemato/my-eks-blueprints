// lib/kubevious_addon.ts
import { Construct } from 'constructs';
import { ManagedPolicy } from "aws-cdk-lib/aws-iam";
import merge from "ts-deepmerge";
import * as blueprints from '@aws-quickstart/eks-blueprints';
import { ServiceAccount } from 'aws-cdk-lib/aws-eks';
import { dependable } from '@aws-quickstart/eks-blueprints/dist/utils/';
import { setPath } from '@aws-quickstart/eks-blueprints/dist/utils/object-utils';
import { ClusterInfo, Values } from "@aws-quickstart/eks-blueprints/dist/spi";
import { createNamespace } from '@aws-quickstart/eks-blueprints/dist/utils/namespace-utils';
import { CertManagerAddOn } from '../lib/certmanager_addon';
/**
 * User provided options for the Helm Chart
 */
export interface AWSPrivateCAIssuerAddonProps extends blueprints.HelmAddOnUserProps {

    /**
     * The name of the service account to use. If createServiceAccount is true, a serviceAccountName is generated.
     */
    serviceAccountName?: string;
   /**
     * An array of Managed IAM Policies which Service Account needs for IRSA Eg: irsaRoles:["CloudWatchFullAccess","AWSCertificateManagerPrivateCAFullAccess"]. If not empty
     * Service Account will be Created by CDK with IAM Roles Mapped (IRSA). In case if its empty, Keda will create the Service Account with out IAM Roles
     */   
     irsaRoles?: string[];  
}

/**
 * Default props to be used when creating the Helm chart
 */
const defaultProps: blueprints.HelmAddOnProps & AWSPrivateCAIssuerAddonProps = {
  name: "blueprints-aws-pca-issuer-addon",
  chart: "aws-privateca-issuer",
  namespace:"aws-pca-issuer",
  version: "1.2.2",
  release: "aws-pca-issuer",
  repository:  "https://cert-manager.github.io/aws-privateca-issuer",
  values: {},
  serviceAccountName: "aws-pca-issuer",
  irsaRoles: []

};

/**
 * Main class to instantiate the Helm chart
 */
export class AWSPrivateCAIssuerAddon extends blueprints.HelmAddOn {

  readonly options: AWSPrivateCAIssuerAddonProps;

  constructor(props?: AWSPrivateCAIssuerAddonProps) {
    super({...defaultProps, ...props});
    this.options = this.props as AWSPrivateCAIssuerAddonProps;
  }

  @dependable('CertManagerAddOn')
  deploy(clusterInfo: blueprints.ClusterInfo): Promise<Construct> {
    //Create Service Account with IRSA
    //Create Service Account with IRSA
    const cluster = clusterInfo.cluster;
    let values: Values = populateValues(this.options);
    values = merge(values, this.props.values ?? {});

    const chart = this.addHelmChart(clusterInfo, values);
    const namespace = createNamespace(this.options.namespace! , cluster);


    if (this.options.irsaRoles!.length > 0 ) {
      //Create Service Account with IRSA
      const opts = { name: this.options.serviceAccountName, namespace: this.options.namespace };
      
      const sa = cluster.addServiceAccount(this.options.serviceAccountName!, opts);
      setRoles(sa,this.options.irsaRoles!);
      
      sa.node.addDependency(namespace);
      chart.node.addDependency(sa);

     } 
     return Promise.resolve(chart);
   
    
  }
}

/**
 * populateValues populates the appropriate values used to customize the Helm chart
 * @param helmOptions User provided values to customize the chart
 */
function populateValues(helmOptions: AWSPrivateCAIssuerAddonProps): blueprints.Values {
  const values = helmOptions.values ?? {};

  setPath(values, "serviceAccount.create",  helmOptions.irsaRoles!.length > 0 ? false : true); 
  setPath(values, "serviceAccount.name",  helmOptions.serviceAccountName); 

  return values;
}



/**
 * This function will set the roles to Service Account
 * @param sa - Service Account Object
 * @param irsaRoles - Array  of Managed IAM Policies
 */
 function setRoles(sa:ServiceAccount, irsaRoles: string[]){
  irsaRoles.forEach((policyName) => {
      const policy = ManagedPolicy.fromAwsManagedPolicyName(policyName);
      sa.role.addManagedPolicy(policy);
    });
}
