// lib/kubevious_addon.ts
import { Construct } from 'constructs';
import * as blueprints from '@aws-quickstart/eks-blueprints';
import { setPath } from '@aws-quickstart/eks-blueprints/dist/utils/object-utils';

/**
 * User provided options for the Helm Chart
 */
export interface KubeviousAddOnProps extends blueprints.HelmAddOnUserProps {
  version?: string,
  ingressEnabled?: boolean,
  kubeviousServiceType?: string,
}

/**
 * Default props to be used when creating the Helm chart
 */
const defaultProps: blueprints.HelmAddOnProps & KubeviousAddOnProps = {
  name: "blueprints-kubevious-addon",
  namespace: "kubevious",
  chart: "kubevious",
  version: "0.9.13",
  release: "kubevious",
  repository:  "https://helm.kubevious.io",
  values: {},

  ingressEnabled: false,
  kubeviousServiceType: "ClusterIP",
};

/**
 * Main class to instantiate the Helm chart
 */
export class KubeviousAddOn extends blueprints.HelmAddOn {

  readonly options: KubeviousAddOnProps;

  constructor(props?: KubeviousAddOnProps) {
    super({...defaultProps, ...props});
    this.options = this.props as KubeviousAddOnProps;
  }

  deploy(clusterInfo: blueprints.ClusterInfo): Promise<Construct> {
    let values: blueprints.Values = populateValues(this.options);
    const chart = this.addHelmChart(clusterInfo, values);

    return Promise.resolve(chart);
  }
}

/**
 * populateValues populates the appropriate values used to customize the Helm chart
 * @param helmOptions User provided values to customize the chart
 */
function populateValues(helmOptions: KubeviousAddOnProps): blueprints.Values {
  const values = helmOptions.values ?? {};

  setPath(values, "ingress.enabled",  helmOptions.ingressEnabled);
  setPath(values, "kubevious.service.type",  helmOptions.kubeviousServiceType);
  setPath(values, "mysql.generate_passwords",  true);

  return values;
}
